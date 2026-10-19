import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

/** /robots.txt — the public site is open to crawlers; the admin, the API and search results are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/search/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
