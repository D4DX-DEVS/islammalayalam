import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { capPublicReads, PUBLIC_MAX_LIMIT } from '@/payload/plugins/publicApiLimits'
import {
  makeUser,
  paragraph,
  richText,
  statusOf,
  testPayload,
  text,
  type SessionUser,
} from './helpers'

let payload: Payload
let editor: SessionUser

// A Local API call with payloadAPI 'REST' runs exactly like GET /api/posts?… from a browser.
// A fresh object each call: Payload writes the session user onto the req it is given.
const rest = () => ({ payloadAPI: 'REST' }) as never

beforeAll(async () => {
  payload = await testPayload()
  editor = await makeUser(payload, 'editor')
  await payload.create({
    collection: 'posts',
    data: {
      title: 'Public API post',
      content: richText(paragraph(text('body'))),
      _status: 'published',
    } as never,
    user: editor,
    overrideAccess: false,
  })
})

describe('signed-out REST reads', () => {
  it('cannot ask for every post at once (?pagination=false / ?limit=0)', async () => {
    for (const query of [{ pagination: false }, { limit: 0 }, { limit: 100000 }]) {
      const res = await payload.find({
        collection: 'posts',
        depth: 4,
        ...query,
        overrideAccess: false,
        req: rest(),
      })
      expect(res.limit).toBe(PUBLIC_MAX_LIMIT)
      expect(res.docs.length).toBeGreaterThan(0)
    }
  })

  it('cannot slip past the cap with a fractional limit (?limit=0.5)', async () => {
    const res = await payload.find({
      collection: 'posts',
      limit: 0.5,
      overrideAccess: false,
      req: rest(),
    })
    expect(res.limit).toBe(1)
    expect(res.docs).toHaveLength(1)
  })

  it('truncates a big list but still fills in every related document', async () => {
    const count = PUBLIC_MAX_LIMIT + 5
    const categories = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        // slug is derived from the name by the collection's hook.
        payload.create({ collection: 'categories', data: { name: `Cap category ${i}` } as never }),
      ),
    )
    const listed = await payload.find({
      collection: 'categories',
      pagination: false,
      overrideAccess: false,
      req: rest(),
    })
    expect(listed.docs).toHaveLength(PUBLIC_MAX_LIMIT)

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: 'Post with many categories',
        content: richText(paragraph(text('body'))),
        categories: categories.map((c) => c.id),
        _status: 'published',
      } as never,
      user: editor,
      overrideAccess: false,
    })
    const res = await payload.find({
      collection: 'posts',
      where: { id: { equals: post.id } },
      overrideAccess: false,
      req: rest(),
    })
    const populated = (res.docs[0]?.categories ?? []) as unknown[]
    expect(populated).toHaveLength(count)
    expect(populated.every((c) => typeof c === 'object' && c !== null)).toBe(true)
  })

  it('still lets the site and signed-in staff read without the cap', async () => {
    const local = await payload.find({ collection: 'posts', pagination: false })
    expect(local.limit).not.toBe(PUBLIC_MAX_LIMIT)
    const staff = await payload.find({
      collection: 'posts',
      limit: 100,
      user: editor,
      overrideAccess: false,
      req: rest(),
    })
    expect(staff.limit).toBe(100)
  })

  it('is registered on every site collection', () => {
    const site = payload.config.collections.filter((c) => !c.slug.startsWith('payload-'))
    expect(site.length).toBeGreaterThan(10)
    for (const collection of site)
      expect(collection.hooks.beforeOperation, collection.slug).toContain(capPublicReads)
  })

  it('cannot read Payload’s own collections (added after plugins, so not capped)', async () => {
    for (const { slug } of payload.config.collections.filter((c) => c.slug.startsWith('payload-')))
      expect(
        await statusOf(() =>
          payload.find({ collection: slug as never, overrideAccess: false, req: rest() }),
        ),
        slug,
      ).toBe(403)
  })
})
