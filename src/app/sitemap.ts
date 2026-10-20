import type { MetadataRoute } from 'next'
import { getSitemapSources } from '@/features/seo/queries'
import { SITE_URL } from '@/lib/site-url'
import { sitemapEntries } from '@/lib/sitemap'

// Read on each request (and kept for an hour by the query): building it needs the database, which the build does not have.
export const dynamic = 'force-dynamic'

/** /sitemap.xml — every published post, page and category, so search engines find (and re-check) the whole site. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(SITE_URL, await getSitemapSources())
}
