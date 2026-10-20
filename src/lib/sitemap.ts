/** The pages of the site that belong in sitemap.xml. Pure, so it is unit-tested; the data comes from features/seo. */
export type SitemapSources = {
  posts: { postNumber?: number | null; updatedAt?: string | null }[]
  pages: { path?: string | null; updatedAt?: string | null }[]
  categories: { slug?: string | null; updatedAt?: string | null }[]
}

export type SitemapEntry = { url: string; lastModified?: Date }

const modified = (value: string | null | undefined): Date | undefined => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : undefined
}

/**
 * Home, the Insights archive, then every category, page and post, each once, as full
 * percent-encoded addresses on `base` (Malayalam paths included).
 */
export function sitemapEntries(base: string, sources: SitemapSources): SitemapEntry[] {
  const seen = new Set<string>()
  const entries: SitemapEntry[] = []
  const add = (path: string | null, updatedAt?: string | null) => {
    if (!path) return
    let url: string
    try {
      url = new URL(path, base).toString()
    } catch {
      return
    }
    if (seen.has(url)) return
    seen.add(url)
    entries.push({ url, lastModified: modified(updatedAt) })
  }
  add('/')
  add('/insights/')
  for (const c of sources.categories) add(c.slug ? `/category/${c.slug}/` : null, c.updatedAt)
  for (const p of sources.pages) add(p.path ? `/${p.path}/` : null, p.updatedAt)
  for (const p of sources.posts) add(p.postNumber ? `/${p.postNumber}/` : null, p.updatedAt)
  return entries
}
