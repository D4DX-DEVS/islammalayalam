import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

/** Kept out of every index: the admin, the API and search results. */
const PRIVATE = ['/admin', '/api/', '/search/']

/**
 * AI search and answer crawlers, named so the site is plainly open to them (GEO). A named group
 * replaces the `*` rules for that bot, so it repeats the private paths.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
]

/** /robots.txt — the public site is open to crawlers (search engines and AI); private paths are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
