import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'

/**
 * Shared read-side config for every frontend query:
 * - `overrideAccess: false` → queries run as an anonymous visitor, so collection access rules
 *   (published only) and field access (staff-only fields hidden) apply even to server code.
 * - `select`/`populate` keep payloads small; tag caching is purged by the revalidate hooks.
 */
export const PUBLIC = { overrideAccess: false, draft: false } as const

export const MEDIA_FIELDS = {
  url: true,
  alt: true,
  width: true,
  height: true,
  sizes: true,
  blurDataURL: true,
  mimeType: true,
  filename: true,
  filesize: true,
  // The Spaces storage plugin builds each file's CDN address from these; without them the folder
  // is missing from the URL and the CDN answers 403.
  prefix: true,
  _objectKey: true,
} as const
export const LINK_POPULATE = {
  pages: { path: true, title: true },
  posts: { postNumber: true, title: true },
  categories: { slug: true, name: true },
} as const
export const POPULATE = {
  ...LINK_POPULATE,
  media: MEDIA_FIELDS,
  authors: { name: true, slug: true },
} as const

/**
 * Short one-way fingerprint of where the data comes from (database + media location). Part of every
 * cache key, so the on-disk data cache can never serve entries written for another database
 * (dev seed vs. local migration, staging vs. production). Reveals nothing about the settings.
 */
function dataSource(): string {
  const { DATABASE_URL = '', MEDIA_DIR = '', MEDIA_CDN_URL = '', S3_PREFIX = '' } = process.env
  return createHash('sha256')
    .update([DATABASE_URL, MEDIA_DIR, MEDIA_CDN_URL, S3_PREFIX].join('\n'))
    .digest('hex')
    .slice(0, 12)
}

/** Cache a query under the given tags (revalidated on publish via src/payload/hooks/revalidate.ts). */
export function cached<A extends unknown[], R>(
  key: string,
  tags: string[],
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, [key, dataSource()], { tags, revalidate: 3600 })
}
