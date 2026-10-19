import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, PUBLIC } from '@/features/shared'
import type { SitemapSources } from '@/lib/sitemap'

/** What sitemap.xml lists: published posts, pages and categories (addresses and dates only). Purged when any of them is saved. */
export const getSitemapSources = cached(
  'seo:sitemap:v1',
  [collectionTag('posts'), collectionTag('pages'), collectionTag('categories')],
  async (): Promise<SitemapSources> => {
    const payload = await getPayloadClient()
    const list = <C extends 'posts' | 'pages' | 'categories'>(
      collection: C,
      select: Record<string, true>,
    ) =>
      payload.find({
        collection,
        select,
        limit: 5000,
        pagination: false,
        depth: 0,
        ...PUBLIC,
      })
    const [posts, pages, categories] = await Promise.all([
      list('posts', { postNumber: true, updatedAt: true }),
      list('pages', { path: true, updatedAt: true }),
      list('categories', { slug: true, updatedAt: true }),
    ])
    return {
      posts: posts.docs as SitemapSources['posts'],
      pages: pages.docs as SitemapSources['pages'],
      categories: categories.docs as SitemapSources['categories'],
    }
  },
)
