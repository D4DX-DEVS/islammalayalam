import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { POPULATE } from '@/features/shared'
import { CARD_SELECT, type PostCardData, type PostList } from '@/features/posts/queries'
import type { PageLink } from '@/features/pages/queries'

export const SEARCH_PAGE_SIZE = 12
const PAGE_HITS = 6

/**
 * Site search over the normalised `searchKey` (title + summary). Not cached: queries are arbitrary
 * visitor input, bounded instead by parseSearchQuery (≤ 8 words, ≤ 80 chars). Payload's `like`
 * escapes every term and requires all of them.
 *
 * `searchKey` is a server-only field, so these reads use overrideAccess — which is why they pin
 * `_status: published` themselves and select only the public card fields.
 */
export async function searchPosts(normalized: string, page: number): Promise<PostList> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'posts',
    where: { and: [{ _status: { equals: 'published' } }, { searchKey: { like: normalized } }] },
    sort: '-publishedAt',
    page,
    limit: SEARCH_PAGE_SIZE,
    depth: 1,
    select: CARD_SELECT,
    populate: POPULATE,
    draft: false,
    overrideAccess: true,
  })
  return {
    docs: res.docs as PostCardData[],
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? page,
  }
}

/** Knowledge-base pages whose title/intro match (shown above the article results). */
export async function searchPages(normalized: string): Promise<PageLink[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: { searchKey: { like: normalized } },
    sort: 'path',
    limit: PAGE_HITS,
    depth: 0,
    select: { title: true, path: true },
    pagination: false,
    overrideAccess: true,
  })
  return res.docs as PageLink[]
}
