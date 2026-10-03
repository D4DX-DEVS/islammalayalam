/**
 * Payload builds absolute media URLs from `serverURL` (e.g. http://localhost:3444/api/media/file/x.webp).
 * Locally stored media is always served by our own /api/media/file route, so those URLs are made
 * relative whatever origin they were built with (port/domain changes, cached data) and next/image
 * treats them as local (images.localPatterns). CDN URLs (production) pass through unchanged.
 */
const LOCAL_MEDIA_PREFIX = '/api/media/file/'

export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith(LOCAL_MEDIA_PREFIX)) return url
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith(LOCAL_MEDIA_PREFIX)) return `${parsed.pathname}${parsed.search}`
    return parsed.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
