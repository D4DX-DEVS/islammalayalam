import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { makeUser, statusOf, testPayload, type SessionUser } from './helpers'

let payload: Payload
let editor: SessionUser

beforeAll(async () => {
  payload = await testPayload()
  editor = await makeUser(payload, 'editor')
})

const createPage = (title: string, slug: string, parent?: string) =>
  payload.create({
    collection: 'pages',
    data: { title, slug, ...(parent ? { parent } : {}) } as never,
    user: editor,
    overrideAccess: false,
  })
const redirectTo = async (from: string) =>
  (
    await payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      overrideAccess: true,
    })
  ).docs[0]?.to

describe('hierarchical page paths', () => {
  it('computes path from the parent chain', async () => {
    const kb = await createPage('KB', 'kb')
    const salah = await createPage('Salah', 'salah', kb.id)
    const wudu = await createPage('Wudu', 'wudu', salah.id)
    expect([kb.path, salah.path, wudu.path]).toEqual(['kb', 'kb/salah', 'kb/salah/wudu'])
  })

  it('moving a page re-paths its subtree and leaves 301s behind', async () => {
    const root = await createPage('Old root', 'old-root')
    const child = await createPage('Child', 'child', root.id)
    await payload.update({
      collection: 'pages',
      id: root.id,
      data: { slug: 'new-root' },
      user: editor,
      overrideAccess: false,
    })
    const movedChild = await payload.findByID({
      collection: 'pages',
      id: child.id,
      overrideAccess: true,
    })
    expect(movedChild.path).toBe('new-root/child')
    expect(await redirectTo('/old-root/')).toBe('/new-root/')
    expect(await redirectTo('/old-root/child/')).toBe('/new-root/child/')
  })

  it('refuses cycles', async () => {
    const a = await createPage('A', 'cycle-a')
    const b = await createPage('B', 'cycle-b', a.id)
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'pages',
          id: a.id,
          data: { parent: b.id },
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(400)
    expect(
      await statusOf(() =>
        payload.update({
          collection: 'pages',
          id: a.id,
          data: { parent: a.id },
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(400)
  })

  it('rejects duplicate paths', async () => {
    await createPage('Dup', 'dup-page')
    expect(await statusOf(() => createPage('Dup 2', 'dup-page'))).not.toBe('ok')
  })
})

describe('redirects', () => {
  it('renaming a category slug leaves a 301 and collapses chains', async () => {
    const cat = await payload.create({
      collection: 'categories',
      data: { name: 'Temp', slug: 'first' },
      user: editor,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'categories',
      id: cat.id,
      data: { slug: 'second' },
      user: editor,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'categories',
      id: cat.id,
      data: { slug: 'third' },
      user: editor,
      overrideAccess: false,
    })
    expect(await redirectTo('/category/first/')).toBe('/category/third/') // not first → second → third
    expect(await redirectTo('/category/second/')).toBe('/category/third/')
    expect(await redirectTo('/category/third/')).toBeUndefined() // the live URL is never redirected
  })

  it('stores redirect sources in canonical form', async () => {
    const r = await payload.create({
      collection: 'redirects',
      data: { from: '/ആദര്‍ശം', to: '/x/', code: '301' },
      user: editor,
      overrideAccess: false,
    })
    expect(r.from).toBe('/ആദർശം/')
    // A protocol-relative source can only ever become a local path (it names a URL on this site).
    const odd = await payload.create({
      collection: 'redirects',
      data: { from: '//attacker.invalid', to: '/x/', code: '301' },
      user: editor,
      overrideAccess: false,
    })
    expect(odd.from).toBe('/attackerinvalid/')
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'redirects',
          data: { from: '/a/', to: 'http://insecure.example', code: '301' },
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(400)
  })
})

describe('post numbers (/<number>/ permalinks)', () => {
  it('keeps explicit legacy numbers and continues the sequence for new posts', async () => {
    const legacy = await payload.create({
      collection: 'posts',
      data: { title: 'Legacy 4306', postNumber: 4306 },
      draft: true,
      overrideAccess: true,
    })
    expect(legacy.postNumber).toBe(4306)
    const next = await payload.create({
      collection: 'posts',
      data: { title: 'New' },
      draft: true,
      user: editor,
      overrideAccess: false,
    })
    expect(next.postNumber).toBeGreaterThan(4306)
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'posts',
          data: { title: 'Clash', postNumber: 4306 },
          draft: true,
          overrideAccess: true,
        }),
      ),
    ).not.toBe('ok')
  })

  it('editors cannot choose or change a post number', async () => {
    const p = await payload.create({
      collection: 'posts',
      data: { title: 'Pick', postNumber: 1 } as never,
      draft: true,
      user: editor,
      overrideAccess: false,
    })
    expect(p.postNumber).not.toBe(1)
    await payload.update({
      collection: 'posts',
      id: p.id,
      data: { postNumber: 2 } as never,
      draft: true,
      user: editor,
      overrideAccess: false,
    })
    expect(
      (await payload.findByID({ collection: 'posts', id: p.id, draft: true, overrideAccess: true }))
        .postNumber,
    ).toBe(p.postNumber)
  })
})
