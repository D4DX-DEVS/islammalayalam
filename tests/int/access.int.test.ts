import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import {
  makeUser,
  paragraph,
  richText,
  statusOf,
  STRONG_PASSWORD,
  testPayload,
  text,
  type SessionUser,
} from './helpers'

let payload: Payload
let admin: SessionUser,
  editor: SessionUser,
  author: SessionUser,
  otherAuthor: SessionUser,
  unenrolledEditor: SessionUser
let publishedId: string, draftId: string

beforeAll(async () => {
  payload = await testPayload()
  admin = await makeUser(payload, 'admin')
  editor = await makeUser(payload, 'editor')
  author = await makeUser(payload, 'author')
  otherAuthor = await makeUser(payload, 'author')
  unenrolledEditor = await makeUser(payload, 'editor', { enrolled: false })
  const pub = await payload.create({
    collection: 'posts',
    data: {
      title: 'Published post',
      content: richText(paragraph(text('body'))),
      _status: 'published',
    } as never,
    user: editor,
    overrideAccess: false,
  })
  const draft = await payload.create({
    collection: 'posts',
    data: { title: 'Secret draft', _status: 'draft' },
    draft: true,
    user: editor,
    overrideAccess: false,
  })
  publishedId = String(pub.id)
  draftId = String(draft.id)
})

describe('anonymous visitors', () => {
  it('cannot list users, audit logs, redirects, contact messages or migration data', async () => {
    for (const collection of [
      'users',
      'audit-logs',
      'redirects',
      'contact-messages',
      'migration-runs',
      'migration-issues',
    ] as const) {
      expect(
        await statusOf(() => payload.find({ collection, overrideAccess: false })),
        collection,
      ).toBe(403)
    }
  })

  it('see published posts only — also when asking for drafts', async () => {
    for (const draft of [false, true]) {
      const res = await payload.find({ collection: 'posts', overrideAccess: false, draft })
      const titles = res.docs.map((d) => d.title)
      expect(titles).toContain('Published post')
      expect(titles).not.toContain('Secret draft')
    }
    expect(
      await statusOf(() =>
        payload.findByID({ collection: 'posts', id: draftId, overrideAccess: false }),
      ),
    ).toBe(404)
  })

  it('never receive staff-only fields', async () => {
    const doc = await payload.findByID({
      collection: 'posts',
      id: publishedId,
      overrideAccess: false,
    })
    for (const field of ['flags', 'createdBy', 'legacy', 'searchText'])
      expect(doc).not.toHaveProperty(field)
  })

  it('cannot write anything', async () => {
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'posts',
          data: { title: 'x' } as never,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.updateGlobal({ slug: 'header', data: { mainMenu: [] }, overrideAccess: false }),
      ),
    ).toBe(403)
  })
})

describe('MFA enrollment gate', () => {
  it('blocks a staff session that has not completed TOTP setup', async () => {
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'posts',
          data: { title: 'no mfa' } as never,
          user: unenrolledEditor,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.find({ collection: 'users', user: unenrolledEditor, overrideAccess: false }),
      ),
    ).toBe(403)
  })

  it('blocks an enrolled user whose session skipped the TOTP step', async () => {
    const passwordOnly = { ...editor, _strategy: 'local-jwt' }
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'posts',
          data: { title: 'no totp step' } as never,
          user: passwordOnly,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
  })
})

describe('roles', () => {
  it('authors write drafts but cannot publish', async () => {
    const draft = await payload.create({
      collection: 'posts',
      data: { title: 'Author draft', _status: 'draft' },
      draft: true,
      user: author,
      overrideAccess: false,
    })
    expect(draft._status).toBe('draft')
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'posts',
          data: { title: 'Author publish', _status: 'published' } as never,
          user: author,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'posts',
          id: draft.id,
          data: { _status: 'published' },
          user: author,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
  })

  it('authors cannot touch other people’s posts, feature posts, or forge createdBy', async () => {
    const mine = await payload.create({
      collection: 'posts',
      data: { title: 'Mine', featured: true, createdBy: admin.id } as never,
      draft: true,
      user: author,
      overrideAccess: false,
    })
    const stored = await payload.findByID({
      collection: 'posts',
      id: mine.id,
      overrideAccess: true,
      draft: true,
    })
    expect(stored.featured).toBe(false)
    expect(typeof stored.createdBy === 'object' ? stored.createdBy?.id : stored.createdBy).toBe(
      author.id,
    )
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'posts',
          id: mine.id,
          data: { title: 'hijack' },
          draft: true,
          user: otherAuthor,
          overrideAccess: false,
        }),
      ),
    ).not.toBe('ok')
    expect(
      await statusOf(() =>
        payload.delete({ collection: 'posts', id: mine.id, user: author, overrideAccess: false }),
      ),
    ).toBe(403)
  })

  it('authors see published posts and their own drafts, never other people’s drafts', async () => {
    const theirs = await payload.create({
      collection: 'posts',
      data: { title: 'Other author draft', _status: 'draft' },
      draft: true,
      user: otherAuthor,
      overrideAccess: false,
    })
    const mine = await payload.create({
      collection: 'posts',
      data: { title: 'My own draft', _status: 'draft' },
      draft: true,
      user: author,
      overrideAccess: false,
    })
    const read = (id: string, user: SessionUser) =>
      statusOf(() =>
        payload.findByID({ collection: 'posts', id, draft: true, user, overrideAccess: false }),
      )
    expect(await read(mine.id, author)).toBe('ok')
    expect(await read(theirs.id, author)).toBe(404)
    expect(await read(theirs.id, editor)).toBe('ok')
    expect(await read(publishedId, author)).toBe('ok')

    const listed = await payload.find({
      collection: 'posts',
      draft: true,
      limit: 200,
      user: author,
      overrideAccess: false,
    })
    const ids = listed.docs.map((d) => d.id)
    expect(ids).toContain(mine.id)
    expect(ids).not.toContain(theirs.id)
    expect(ids).not.toContain(draftId)

    const versions = await payload.findVersions({
      collection: 'posts',
      limit: 200,
      user: author,
      overrideAccess: false,
    })
    const parents = versions.docs.map((v) =>
      typeof v.parent === 'object' ? (v.parent as { id: string }).id : v.parent,
    )
    expect(parents).toContain(mine.id)
    expect(parents).not.toContain(theirs.id)
  })

  it('editors cannot manage users or change their own role', async () => {
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'users',
          data: { email: 'x@test.local', password: STRONG_PASSWORD, role: 'admin' },
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'admin' },
      user: editor,
      overrideAccess: false,
    })
    const self = await payload.findByID({
      collection: 'users',
      id: editor.id,
      overrideAccess: true,
    })
    expect(self.role).toBe('editor')
  })

  it('the audit log is readable by admins and immutable for everyone', async () => {
    const logs = await payload.find({
      collection: 'audit-logs',
      user: admin,
      overrideAccess: false,
      where: { target: { equals: 'posts' } },
    })
    expect(logs.totalDocs).toBeGreaterThan(0)
    const first = logs.docs[0]!
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'audit-logs',
          id: first.id,
          data: { action: 'login' },
          user: admin,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.delete({
          collection: 'audit-logs',
          id: first.id,
          user: admin,
          overrideAccess: false,
        }),
      ),
    ).toBe(403)
    expect(
      await statusOf(() =>
        payload.find({ collection: 'audit-logs', user: editor, overrideAccess: false }),
      ),
    ).toBe(403)
  })
})

describe('authentication hardening', () => {
  it('locks an account after 5 failed logins (even the right password is then refused)', async () => {
    const victim = await makeUser(payload, 'author')
    const login = (password: string) =>
      payload.login({ collection: 'users', data: { email: victim.email, password } })
    expect(await statusOf(() => login(STRONG_PASSWORD))).toBe('ok') // control: credentials are valid
    for (let i = 0; i < 5; i++) expect(await statusOf(() => login('wrong-password-123'))).toBe(401)
    // Payload answers a locked account with 401 + LockedAuth (no 423, so lock state is not advertised).
    const err = await login(STRONG_PASSWORD).then(
      () => null,
      (e: Error) => e,
    )
    expect(err?.name).toBe('LockedAuth')
  })

  it('enforces the 12-character password policy on create, update and reset', async () => {
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'users',
          data: { email: 'short@test.local', password: 'short', role: 'author' },
          overrideAccess: true,
        }),
      ),
    ).toBe(400)
    const u = await makeUser(payload, 'author')
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'users',
          id: u.id,
          data: { password: 'tiny' },
          overrideAccess: true,
        }),
      ),
    ).toBe(400)
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: u.email },
      disableEmail: true,
    })
    expect(
      await statusOf(() =>
        payload.resetPassword({
          collection: 'users',
          data: { token: String(token), password: 'tiny' },
          overrideAccess: true,
        }),
      ),
    ).toBe(400)
  })
})
