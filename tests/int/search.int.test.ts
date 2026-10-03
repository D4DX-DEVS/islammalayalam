import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { searchPages, searchPosts } from '@/features/search/queries'
import { parseSearchQuery } from '@/lib/text/search'
import { paragraph, richText, testPayload, text } from './helpers'

let payload: Payload
const LEGACY = 'ഖുര്‍ആന്‍' // ഖുര്‍ആന്‍ as WordPress stored it
const ATOMIC = 'ഖുർആൻ' // ഖുർആൻ as a phone keyboard types it
const q = (value: string) => parseSearchQuery(value)!.normalized

beforeAll(async () => {
  payload = await testPayload()
  const content = richText(paragraph(text('body')))
  await payload.create({
    collection: 'posts',
    data: {
      title: `${LEGACY} പഠന പരമ്പര`,
      content,
      format: 'standard',
      _status: 'published',
      publishedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'posts',
    data: { title: `${LEGACY} കരട് ലേഖനം`, content, _status: 'draft' },
    overrideAccess: true,
    draft: true,
  })
  await payload.create({
    collection: 'pages',
    data: { title: `${LEGACY}: ആമുഖം`, slug: 'search-test-page', kind: 'static' },
    overrideAccess: true,
  })
})

describe('site search', () => {
  it('finds published posts whichever chillu spelling is typed', async () => {
    for (const term of [LEGACY, ATOMIC]) {
      const res = await searchPosts(q(term), 1)
      expect(res.docs.map((d) => d.title)).toEqual([`${LEGACY} പഠന പരമ്പര`])
    }
  })

  it('never returns drafts and only returns public card fields', async () => {
    const res = await searchPosts(q(`${ATOMIC} കരട്`), 1)
    expect(res.totalDocs).toBe(0)
    const hit = (await searchPosts(q(ATOMIC), 1)).docs[0] as Record<string, unknown>
    for (const field of ['searchKey', 'searchText', 'legacy', 'flags', 'createdBy', 'content'])
      expect(hit).not.toHaveProperty(field)
  })

  it('requires every term and treats regex characters literally', async () => {
    expect((await searchPosts(q(`${ATOMIC} നിലവിലില്ലാത്ത`), 1)).totalDocs).toBe(0)
    expect((await searchPosts(q('.* (a+)+$'), 1)).totalDocs).toBe(0)
  })

  it('matches knowledge-base pages by title', async () => {
    const pages = await searchPages(q(ATOMIC))
    expect(pages.map((p) => p.title)).toContain(`${LEGACY}: ആമുഖം`)
  })

  it('saves very long articles (search text above Payload’s 40 000-character default)', async () => {
    const long = 'ദീർഘമായ ലേഖനം '.repeat(3500) // ~52 000 characters
    const doc = await payload.create({
      collection: 'posts',
      data: {
        title: 'Long article',
        content: richText(paragraph(text(long))),
        format: 'standard',
        _status: 'published', // drafts skip validation; a published save is what failed
      },
      overrideAccess: true,
    })
    expect(doc.id).toBeTruthy()
  })
})
