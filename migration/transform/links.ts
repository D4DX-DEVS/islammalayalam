import { isSafeHref } from '@/lib/security/url'
import {
  DEAD_HOSTS,
  isApprovedLinkHost,
  isRedirectLink,
  OWN_HOSTS,
  SPAM_LINK,
} from '../lib/exclusions'

/**
 * Link rewriting for migrated content:
 *  - links to this site (any of its hosts, http or https) become site paths in the new URL scheme
 *    (/?p=123 → /123/, /?page_id=… → the page's path, /?cat= → the category, trailing slash kept)
 *  - uploads (/wp-content/uploads/…) are resolved to the migrated media file when known
 *  - dead hosts, spam, redirect services and every site not on APPROVED_LINK_HOSTS are dropped
 *    (the text stays, the link goes)
 *  - approved outside links are upgraded to https; mailto/tel pass through
 */
export type LinkResolvers = {
  /** WordPress page id → new path (e.g. /ആദർശം/വിശ്വാസം/). */
  pagePath?: (wpId: number) => string | null
  /** WordPress category id → new path (/category/<slug>/). */
  categoryPath?: (wpId: number) => string | null
  /** Upload URL (normalised, no size suffix) → public URL of the migrated media file. */
  uploadUrl?: (url: string) => string | null
}

export type LinkDecision =
  | { keep: true; url: string; external: boolean }
  | {
      keep: false
      reason: 'dead-host' | 'spam' | 'redirect' | 'not-approved' | 'unsafe' | 'empty' | 'unmapped'
    }

const SITE = 'https://islammalayalam.net'

export function rewriteHref(raw: string, resolvers: LinkResolvers = {}): LinkDecision {
  const href = raw.trim()
  if (!href || href === '#') return { keep: false, reason: 'empty' }
  if (/^(mailto|tel):/i.test(href))
    return isSafeHref(href)
      ? { keep: true, url: href, external: true }
      : { keep: false, reason: 'unsafe' }

  let url: URL
  try {
    url = new URL(href, SITE)
  } catch {
    return { keep: false, reason: 'unsafe' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { keep: false, reason: 'unsafe' }
  const host = url.hostname.toLowerCase()
  if (DEAD_HOSTS.has(host)) return { keep: false, reason: 'dead-host' }
  if (SPAM_LINK.test(host)) return { keep: false, reason: 'spam' }
  // Checked for this site's own links too: /?redirect_to=https://elsewhere must not survive either.
  if (!OWN_HOSTS.has(host) && isRedirectLink(url)) return { keep: false, reason: 'redirect' }

  if (OWN_HOSTS.has(host)) {
    const internal = internalPath(url, resolvers)
    return internal
      ? { keep: true, url: internal, external: false }
      : { keep: false, reason: 'unmapped' }
  }
  if (!isApprovedLinkHost(host)) return { keep: false, reason: 'not-approved' }
  url.protocol = 'https:'
  const out = url.toString()
  return isSafeHref(out)
    ? { keep: true, url: out, external: true }
    : { keep: false, reason: 'unsafe' }
}

/**
 * Matching key for an upload URL: https, canonical host, no size-variant suffix
 * (…-300x200.jpg and …-scaled.jpg both → ….jpg). Used on BOTH sides (content refs and the media
 * library), so a reference finds its library item; the file itself is downloaded from the library's
 * own URL.
 */
export function originalUploadUrl(url: URL): string {
  const path = url.pathname.replace(/-(?:\d{2,5}x\d{2,5}|scaled)(?=\.[a-z0-9]{2,5}$)/i, '')
  return `${SITE}${path}`
}

function internalPath(url: URL, r: LinkResolvers): string | null {
  const q = url.searchParams
  if (url.pathname === '/' || url.pathname === '') {
    const p = Number(q.get('p'))
    if (Number.isInteger(p) && p > 0) return `/${p}/`
    const page = Number(q.get('page_id'))
    if (Number.isInteger(page) && page > 0) return r.pagePath?.(page) ?? null
    const cat = Number(q.get('cat'))
    if (Number.isInteger(cat) && cat > 0) return r.categoryPath?.(cat) ?? null
    const s = q.get('s')
    if (s) return `/search/?q=${encodeURIComponent(s)}`
    return '/'
  }
  if (url.pathname.startsWith('/wp-content/uploads/')) {
    const migrated = r.uploadUrl?.(originalUploadUrl(url))
    return migrated ?? null
  }
  if (url.pathname.startsWith('/wp-')) return null // admin, login, feeds of the old install
  if (/\.php$/i.test(url.pathname)) return null // PHP scripts of the old install do not exist here
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  const decoded = `${safeDecode(path)}${url.hash}`
  // Decoding can surface characters browsers ignore ("%09" → tab), turning "/%09/x.invalid/" into
  // an off-site "//x.invalid/": such paths are never real pages of this site.
  return /[\u0000-\u001F\u007F-\u009F]/.test(decoded) || /^\/[/\\]/.test(decoded) ? null : decoded
}

/** Readable Unicode path (the router accepts both forms); undecodable input stays encoded. */
function safeDecode(path: string): string {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}
