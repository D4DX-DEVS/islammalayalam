import type { CollectionBeforeChangeHook } from 'payload'
import { EBOOK_CATEGORY_SLUG, withCategory } from '@/lib/ebook'

/**
 * Every e-book is listed under the E-Books category (/category/e-books/): when a post's format is
 * E-book, that category is added to its categories (kept last, so the primary category stays).
 * Runs before derivePostFields, so an e-book with no other category gets E-Books as primary.
 */
export const addEbookCategory: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const format = data?.format ?? originalDoc?.format
  if (format !== 'ebook') return data
  const found = await req.payload.find({
    collection: 'categories',
    where: { slug: { equals: EBOOK_CATEGORY_SLUG } },
    limit: 1,
    depth: 0,
    pagination: false,
    req,
  })
  const category = found.docs[0]
  if (!category) return data
  return {
    ...data,
    categories: withCategory(data?.categories ?? originalDoc?.categories, String(category.id)),
  }
}
