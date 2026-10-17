import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { Secret } from 'otpauth'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isMfaRequired, resetMfaSettingCache, SECURITY_SETTINGS } from '@/payload/mfa'
import { makeUser, statusOf, STRONG_PASSWORD, testPayload, type SessionUser } from './helpers'

let payload: Payload
let admin: SessionUser
let editor: SessionUser
let unenrolled: SessionUser

beforeAll(async () => {
  payload = await testPayload()
  admin = await makeUser(payload, 'admin')
  editor = await makeUser(payload, 'editor')
  unenrolled = await makeUser(payload, 'editor', { enrolled: false })
})

const setRequired = (requireTwoFactor: boolean) =>
  payload.updateGlobal({
    slug: SECURITY_SETTINGS,
    data: { requireTwoFactor },
    user: admin,
    overrideAccess: false,
  })

afterAll(async () => {
  await setRequired(true)
})

const rawSecret = async (id: string | number) =>
  (
    (await (payload.db as unknown as MongooseAdapter).collections
      .users!.findById(id, { totpSecret: 1 })
      .lean()) as { totpSecret?: string | null } | null
  )?.totpSecret

/** A session as Payload builds it: the user loaded from the database, signed in by `strategy`. */
const sessionOf = async (user: SessionUser, strategy: 'local-jwt' | 'totp') => {
  const doc = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  return { ...doc, collection: 'users' as const, _strategy: strategy }
}
const createPost = (user: object) =>
  statusOf(() =>
    payload.create({
      collection: 'posts',
      data: { title: 'mfa setting' } as never,
      user,
      overrideAccess: false,
    }),
  )

describe('Settings → Security: two-step verification on/off', () => {
  it('is required by default and every loaded user carries the setting', async () => {
    resetMfaSettingCache()
    expect(await isMfaRequired(payload)).toBe(true)
    expect((await sessionOf(editor, 'local-jwt')).mfaRequired).toBe(true)
  })

  it('only a fully signed-in admin can read or change it', async () => {
    for (const user of [editor, { ...admin, _strategy: 'local-jwt' }]) {
      expect(
        await statusOf(() =>
          payload.findGlobal({ slug: SECURITY_SETTINGS, user, overrideAccess: false }),
        ),
      ).toBe(403)
      expect(
        await statusOf(() =>
          payload.updateGlobal({
            slug: SECURITY_SETTINGS,
            data: { requireTwoFactor: false },
            user,
            overrideAccess: false,
          }),
        ),
      ).toBe(403)
    }
    expect(await isMfaRequired(payload)).toBe(true)
  })

  it('while on: password-only sessions get nothing, not even Payload default operations', async () => {
    expect(await createPost(await sessionOf(editor, 'local-jwt'))).toBe(403)
    expect(await createPost(await sessionOf(unenrolled, 'local-jwt'))).toBe(403)
    // `pages` has no readVersions rule of its own: Payload's default would admit any signed-in user.
    const passwordOnly = { ...editor, _strategy: 'local-jwt' }
    expect(
      await statusOf(() =>
        payload.findVersions({ collection: 'pages', user: passwordOnly, overrideAccess: false }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.findVersions({ collection: 'pages', user: editor, overrideAccess: false }),
      ),
    ).toBe('ok')
  })

  it('turned off: the password alone signs in, with or without an authenticator app', async () => {
    await (payload.db as unknown as MongooseAdapter).collections.users!.updateOne(
      { _id: editor.id },
      { $set: { totpSecret: new Secret({ size: 20 }).base32 } },
    )
    await setRequired(false)
    expect(await isMfaRequired(payload)).toBe(false)
    const enrolledSession = await sessionOf(editor, 'local-jwt')
    expect(enrolledSession).toMatchObject({ hasTotp: true, mfaRequired: false })
    expect(await createPost(enrolledSession)).toBe('ok')
    expect(await createPost(await sessionOf(unenrolled, 'local-jwt'))).toBe('ok')
  })

  it('turned back on: password-only sessions are refused again at once', async () => {
    await setRequired(true)
    expect(await isMfaRequired(payload)).toBe(true)
    expect(await createPost(await sessionOf(unenrolled, 'local-jwt'))).toBe(403)
  })

  it('the change is audited', async () => {
    const { docs } = await payload.find({
      collection: 'audit-logs',
      where: { target: { equals: `global:${SECURITY_SETTINGS}` } },
      overrideAccess: true,
    })
    expect(docs.length).toBeGreaterThanOrEqual(2)
    expect(docs.every((d) => d.changed?.includes('requireTwoFactor'))).toBe(true)
  })
})

describe('an enrolled authenticator app stays enrolled', () => {
  it('survives login and profile updates, so the QR setup is shown only once', async () => {
    const user = await makeUser(payload, 'editor')
    const secret = new Secret({ size: 20 }).base32
    // The same write payload-totp's setup endpoint does.
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { totpSecret: secret } as never,
      overrideAccess: true,
    })
    const login = await payload.login({
      collection: 'users',
      data: { email: user.email, password: STRONG_PASSWORD },
    })
    expect((login.user as { hasTotp?: boolean }).hasTotp).toBe(true)
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name: 'renamed' },
      overrideAccess: true,
    })
    expect(await rawSecret(user.id)).toBe(secret)
  })

  it('survives switching two-step off and on again', async () => {
    const user = await makeUser(payload, 'editor')
    const secret = new Secret({ size: 20 }).base32
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { totpSecret: secret } as never,
      overrideAccess: true,
    })
    await setRequired(false)
    await setRequired(true)
    expect(await rawSecret(user.id)).toBe(secret)
    expect((await sessionOf(user, 'local-jwt')).hasTotp).toBe(true)
  })
})
