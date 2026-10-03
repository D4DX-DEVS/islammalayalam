import 'server-only'
import type { Where } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import type { Post, User } from '@/payload-types'

const TAGS = [collectionTag('posts'), collectionTag('media'), collectionTag('categories')]
export const CARD_SELECT = {
  title: true,
  excerpt: true,
  featuredImage: true,
  postNumber: true,
  publishedAt: true,
  format: true,
  primaryCategory: true,
  video: true,
  readingMinutes: true,
} as const

export type PostCardData = Pick<
  Post,
  | 'id'
  | 'title'
  | 'excerpt'
  | 'featuredImage'
  | 'postNumber'
  | 'publishedAt'
  | 'format'
  | 'primaryCategory'
  | 'video'
  | 'readingMinutes'
>
export type PostList = { docs: PostCardData[]; totalDocs: number; totalPages: number; page: number }
export type PostListQuery = {
  categoryId?: string
  format?: Post['format']
  featured?: boolean
  authorId?: string
  excludeId?: string
  page?: number
  limit?: number
}

export const listPosts = cached('posts:list', TAGS, async (q: PostListQuery): Promise<PostList> => {
  const payload = await getPayloadClient()
  const and: Where[] = [{ _status: { equals: 'published' } }]
  if (q.categoryId) and.push({ categories: { in: [q.categoryId] } })
  if (q.format) and.push({ format: { equals: q.format } })
  if (q.featured) and.push({ featured: { equals: true } })
  if (q.authorId) and.push({ author: { equals: q.authorId } })
  if (q.excludeId) and.push({ id: { not_equals: q.excludeId } })
  const res = await payload.find({
    collection: 'posts',
    where: { and },
    sort: '-publishedAt',
    page: q.page ?? 1,
    limit: Math.min(q.limit ?? 12, 48),
    depth: 1,
    select: CARD_SELECT,
    populate: POPULATE,
    ...PUBLIC,
  })
  return {
    docs: res.docs as PostCardData[],
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? 1,
  }
})

export const getPostByNumber = cached(
  'posts:by-number',
  TAGS,
  async (postNumber: number): Promise<Post | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'posts',
      where: {
        and: [{ postNumber: { equals: postNumber } }, { _status: { equals: 'published' } }],
      },
      limit: 1,
      depth: 2,
      populate: POPULATE,
      pagination: false,
      ...PUBLIC,
    })
    return (res.docs[0] as Post | undefined) ?? null
  },
)

/** Legacy WordPress slug (/<slug>/) → post number, for 301s to the canonical /<number>/ URL. */
export const findPostNumberByLegacySlug = cached(
  'posts:legacy-slug',
  [collectionTag('posts')],
  async (slug: string): Promise<number | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'posts',
      where: {
        and: [{ 'legacy.legacySlugs': { equals: slug } }, { _status: { equals: 'published' } }],
      },
      limit: 1,
      depth: 0,
      select: { postNumber: true },
      overrideAccess: true, // legacy.* is staff-only for API readers; only the number leaves this function
      pagination: false,
    })
    return (res.docs[0]?.postNumber as number | undefined) ?? null
  },
)

/**
 * Live preview only: the latest version (draft or published) AS the signed-in staff user, so their
 * read access applies. Never cached — callers must have checked the preview session first
 * (src/features/preview/session.ts).
 */
export async function getPostPreview(postNumber: number, user: User): Promise<Post | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'posts',
    where: { postNumber: { equals: postNumber } },
    draft: true,
    user,
    overrideAccess: false,
    disableErrors: true,
    limit: 1,
    depth: 2,
    populate: POPULATE,
    pagination: false,
  })
  return (res.docs[0] as Post | undefined) ?? null
}
