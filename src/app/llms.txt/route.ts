import { listCategories } from '@/features/categories/queries'
import { listPosts } from '@/features/posts/queries'
import { getSiteSettings } from '@/features/site/queries'
import { llmsTxt } from '@/lib/llms'

// Built from the database on request (the build has none); the queries cache it.
export const dynamic = 'force-dynamic'

/** /llms.txt — the site map for AI assistants (llmstxt.org). */
export async function GET(): Promise<Response> {
  const [settings, categories, posts] = await Promise.all([
    getSiteSettings(),
    listCategories(),
    listPosts({ limit: 30 }),
  ])
  const body = llmsTxt({
    name: settings.siteName,
    alternateName: settings.siteNameMl,
    tagline: settings.tagline,
    categories,
    posts: posts.docs,
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
