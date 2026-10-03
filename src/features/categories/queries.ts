import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import type { Author, Category } from '@/payload-types'

export const getCategoryBySlug = cached(
  'categories:by-slug',
  [collectionTag('categories')],
  async (slug: string): Promise<Category | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      populate: POPULATE,
      pagination: false,
      ...PUBLIC,
    })
    return (res.docs[0] as Category | undefined) ?? null
  },
)

export const getAuthorBySlug = cached(
  'authors:by-slug',
  [collectionTag('authors')],
  async (slug: string): Promise<Author | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'authors',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      populate: POPULATE,
      pagination: false,
      ...PUBLIC,
    })
    return (res.docs[0] as Author | undefined) ?? null
  },
)

export type CategoryChip = Pick<Category, 'id' | 'name' | 'slug'>

/** Visible categories in editor order (topic chips on the homepage). */
export const listCategories = cached(
  'categories:list',
  [collectionTag('categories')],
  async (): Promise<CategoryChip[]> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'categories',
      where: { hidden: { not_equals: true } },
      sort: 'order',
      limit: 40,
      depth: 0,
      select: { name: true, slug: true },
      pagination: false,
      ...PUBLIC,
    })
    return res.docs as CategoryChip[]
  },
)
