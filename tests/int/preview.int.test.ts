import type { Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { authenticatePreview, getPreviewUser, previewPathOf } from '@/features/preview/session'
import { makeUser, testPayload, type SessionUser } from './helpers'

let payload: Payload
beforeAll(async () => {
  payload = await testPayload()
})
afterEach(() => {
  vi.restoreAllMocks()
})

/** What payload.auth() resolves for the request (the session strategies themselves are Payload's). */
const sessionIs = (user: Partial<SessionUser> | null) =>
  vi.spyOn(payload, 'auth').mockResolvedValue({ user, permissions: {} } as never)
const check = () => authenticatePreview(payload, new Headers())

describe('who may preview unpublished content', () => {
  it('a staff member who finished the TOTP step', async () => {
    for (const role of ['admin', 'editor', 'author'] as const) {
      const user = await makeUser(payload, role)
      sessionIs(user)
      expect((await check())?.id, role).toBe(user.id)
    }
  })

  it('nobody else: anonymous, password-only (enrolled or not), non-staff, broken auth', async () => {
    const enrolled = await makeUser(payload, 'editor')
    const notEnrolled = await makeUser(payload, 'editor', { enrolled: false })
    for (const [label, user] of [
      ['anonymous', null],
      ['password only, enrolled', { ...enrolled, _strategy: 'local-jwt' }],
      ['password only, not enrolled', { ...notEnrolled, _strategy: 'local-jwt' }],
      ['no staff role', { ...enrolled, role: null }],
      ['another auth collection', { ...enrolled, collection: 'authors' }],
    ] as const) {
      sessionIs(user as Partial<SessionUser> | null)
      expect(await check(), label).toBeNull()
    }
    vi.spyOn(payload, 'auth').mockRejectedValue(new Error('strategy failed'))
    expect(await check(), 'auth error').toBeNull()
  })

  it('is never on outside a request (scripts, tests, build-time code)', async () => {
    expect(await getPreviewUser()).toBeNull()
  })
})

describe('where a preview lands', () => {
  it('is the document’s own public path, looked up with the user’s read access', async () => {
    const author = await makeUser(payload, 'author')
    const other = await makeUser(payload, 'author')
    const draft = await payload.create({
      collection: 'posts',
      data: { title: 'Preview landing draft', _status: 'draft' },
      draft: true,
      user: author,
      overrideAccess: false,
    })
    const target = { kind: 'collection', collection: 'posts', id: draft.id } as const
    expect(await previewPathOf(payload, author, target)).toBe(`/${draft.postNumber}/`)
    expect(await previewPathOf(payload, other, target), 'other author’s draft').toBeNull()
    expect(await previewPathOf(payload, author, { kind: 'global', global: 'homepage' })).toBe('/')
    const missing = { kind: 'collection', collection: 'pages', id: '0'.repeat(24) } as const
    expect(await previewPathOf(payload, author, missing)).toBeNull()
  })
})
