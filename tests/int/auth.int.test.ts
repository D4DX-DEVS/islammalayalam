import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { Secret, TOTP } from 'otpauth'
import { createLocalReq } from 'payload'
import type { Payload, PayloadHandler } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { blockRemoteFirstUser } from '@/payload/collections/Users'
import {
  guardVerify,
  lockDuration,
  TOTP_GUARD_COLLECTION,
  TOTP_LOCK_MS,
  TOTP_MAX_ATTEMPTS,
  type TotpGuardDoc,
} from '@/payload/plugins/totpGuard'
import { makeUser, STRONG_PASSWORD, testPayload, type SessionUser } from './helpers'

let payload: Payload
beforeAll(async () => {
  payload = await testPayload()
})

const db = () => payload.db as unknown as MongooseAdapter
const guardDocs = () => db().connection.collection<TotpGuardDoc>(TOTP_GUARD_COLLECTION)
const stateOf = (id: string | number) => guardDocs().findOne({ _id: String(id) })
const lockouts = (id: string | number) =>
  payload.count({
    collection: 'audit-logs',
    where: { action: { equals: 'mfa-lockout' }, docId: { equals: String(id) } },
    overrideAccess: true,
  })

function wrongCode(totp: TOTP): string {
  const valid = new Set(
    [-1, 0, 1].map((s) => totp.generate({ timestamp: Date.now() + s * 30_000 })),
  )
  for (let n = 0; ; n++)
    if (!valid.has(String(n).padStart(6, '0'))) return String(n).padStart(6, '0')
}

describe('TOTP guard (second-factor attempt limit + replay protection)', () => {
  let user: SessionUser
  let totp: TOTP
  let inner: ReturnType<typeof vi.fn<PayloadHandler>>
  let handler: PayloadHandler

  const verifyWith = async (h: PayloadHandler, token: string) => {
    const req = await createLocalReq({ user: user as never }, payload)
    req.data = { token }
    return h(req)
  }
  const verify = (token: string) => verifyWith(handler, token)
  const lockNow = async () => {
    for (let i = 0; i < TOTP_MAX_ATTEMPTS; i++) await verify(wrongCode(totp))
  }

  beforeEach(async () => {
    user = await makeUser(payload, 'editor')
    const secret = new Secret({ size: 20 })
    await db().collections.users!.updateOne(
      { _id: user.id },
      { $set: { totpSecret: secret.base32 } },
    )
    totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret })
    inner = vi.fn<PayloadHandler>(async () => Response.json({ ok: true }))
    handler = guardVerify(inner)
  })

  it('wraps the real /api/verify-totp endpoint', async () => {
    const endpoint = payload.config.endpoints.find(
      (e) => e.path === '/verify-totp' && e.method === 'post',
    )
    await guardDocs().insertOne({
      _id: String(user.id),
      attempts: 0,
      lockouts: 1,
      lockedUntil: new Date(Date.now() + 60_000),
      lastStep: null,
    })
    expect((await verifyWith(endpoint!.handler, totp.generate())).status).toBe(429) // the plugin alone never answers 429
  })

  it('locks after repeated wrong codes; while locked even the right code is refused', async () => {
    for (let i = 1; i < TOTP_MAX_ATTEMPTS; i++)
      expect((await verify(wrongCode(totp))).status).toBe(400)
    expect((await verify(wrongCode(totp))).status).toBe(429)
    expect((await verify(totp.generate())).status).toBe(429)
    expect(inner).not.toHaveBeenCalled()
    expect((await lockouts(user.id)).totalDocs).toBe(1)
  })

  it('caps parallel guessing at the attempt limit', async () => {
    const statuses = (
      await Promise.all(Array.from({ length: 20 }, () => verify(wrongCode(totp))))
    ).map((r) => r.status)
    expect(statuses.filter((s) => s === 400)).toHaveLength(TOTP_MAX_ATTEMPTS - 1)
    expect(statuses.filter((s) => s === 429)).toHaveLength(20 - (TOTP_MAX_ATTEMPTS - 1))
    expect((await lockouts(user.id)).totalDocs).toBe(1)
  })

  it('accepts a code once and refuses to replay it, even in parallel', async () => {
    const code = totp.generate()
    const [a, b] = await Promise.all([verify(code), verify(code)])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    expect(inner).toHaveBeenCalledTimes(1)
    expect((await verify(code)).status).toBe(400)
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('a correct code resets the counters; each consecutive lockout locks for twice as long', async () => {
    for (let i = 1; i < TOTP_MAX_ATTEMPTS; i++) await verify(wrongCode(totp))
    expect((await verify(totp.generate())).status).toBe(200)
    expect(await stateOf(user.id)).toMatchObject({ attempts: 0, lockouts: 0 })

    await lockNow()
    const first = await stateOf(user.id)
    expect(first?.lockouts).toBe(1)
    expect(first!.lockedUntil!.getTime() - Date.now()).toBeGreaterThan(TOTP_LOCK_MS - 60_000)

    await guardDocs().updateOne(
      { _id: String(user.id) },
      { $set: { lockedUntil: new Date(Date.now() - 1000) } },
    ) // lock expires
    await lockNow()
    const second = await stateOf(user.id)
    expect(second?.lockouts).toBe(2)
    expect(second!.lockedUntil!.getTime() - Date.now()).toBeGreaterThan(2 * TOTP_LOCK_MS - 60_000)
  })

  it("Payload's own user writes (login, update) cannot roll the guard back", async () => {
    await lockNow()
    await payload.login({
      collection: 'users',
      data: { email: user.email, password: STRONG_PASSWORD },
    })
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name: 'renamed' },
      overrideAccess: true,
    })
    const state = await stateOf(user.id)
    expect(state?.lockedUntil?.getTime()).toBeGreaterThan(Date.now())
    expect((await verify(totp.generate())).status).toBe(429)
  })
})

describe('lockDuration', () => {
  it('doubles per consecutive lockout and caps at 24 hours', () => {
    expect([1, 2, 3, 4].map(lockDuration)).toEqual([
      TOTP_LOCK_MS,
      2 * TOTP_LOCK_MS,
      4 * TOTP_LOCK_MS,
      8 * TOTP_LOCK_MS,
    ])
    expect(lockDuration(50)).toBe(24 * 60 * 60 * 1000)
  })
})

describe('first account', () => {
  const run = (payloadAPI: string, users: number) =>
    blockRemoteFirstUser({
      args: {},
      operation: 'create',
      req: { payloadAPI, payload: { count: async () => ({ totalDocs: users }) } },
    } as never)

  it('cannot be created over HTTP on an empty database (first-register takeover)', async () => {
    await expect(run('REST', 0)).rejects.toMatchObject({ status: 403 })
    await expect(run('local', 0)).resolves.toEqual({})
    await expect(run('REST', 1)).resolves.toEqual({})
  })
})
