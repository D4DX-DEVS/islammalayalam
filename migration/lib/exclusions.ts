import type { WpPage, WpPost } from './snapshot'

/**
 * Documented exclusions and special cases (audit §3 / §7). Nothing is deleted from WordPress; these
 * records are simply not migrated and their URLs answer 410 Gone on the new site.
 */

/** Soledad theme demo categories (travel/finance demo content). */
export const DEMO_CATEGORY_IDS = new Set([
  254, 255, 256, 257, 258, 259, 260, 264, 265, 266, 267, 268, 269,
])

/** `slider` was a placement flag, not a topic → becomes `featured: true`, no category. */
export const SLIDER_CATEGORY_ID = 89

/** Real but catch-all category: migrated, hidden from public listings. */
export const HIDDEN_CATEGORY_IDS = new Set([1])

/** Category → post format on the new site (WordPress stored most media posts as "standard"). */
export const FORMAT_BY_CATEGORY: Record<number, 'video' | 'audio' | 'ebook'> = {
  82: 'video',
  86: 'audio',
  84: 'ebook',
}

/** Hosts that no longer resolve (audit §4): images are dropped, links unwrapped to plain text. */
export const DEAD_HOSTS = new Set([
  'campusalive.in',
  'www.campusalive.in',
  'majilismedia.com',
  'www.majilismedia.com',
  'soledad.pencidesign.com',
  'soledad.pencidesign.net',
])

/** Hosts that are this site (current, www, old staging). */
export const OWN_HOSTS = new Set([
  'islammalayalam.net',
  'www.islammalayalam.net',
  'beta.islammalayalam.net',
])

/**
 * Short-link and redirect services: where they lead can change at any time (a classic way to hide
 * malware behind an innocent link), so no migrated link may go through one.
 */
export const REDIRECTOR_HOSTS = new Set([
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'v.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'rb.gy',
  't.ly',
  'tiny.cc',
  'lnkd.in',
  's.id',
  'bl.ink',
  'soo.gd',
  'adf.ly',
  'shorte.st',
  'fb.me',
  'l.facebook.com',
  'lm.facebook.com',
  'l.instagram.com',
  'out.reddit.com',
  'href.li',
  'urlz.fr',
  'clck.ru',
  'qr.ae',
  'dlvr.it',
  'trib.al',
  'db.tt',
])

/** A link that forwards the reader elsewhere: a redirect service, or an address carried in the query. */
export function isRedirectLink(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (REDIRECTOR_HOSTS.has(host)) return true
  if (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname === '/url') return true
  if (/(^|\.)youtube\.com$/.test(host) && url.pathname === '/redirect') return true
  for (const value of url.searchParams.values()) {
    if (!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value.trim())) continue
    try {
      if (new URL(value.trim(), url).hostname.toLowerCase() !== url.hostname.toLowerCase())
        return true
    } catch {
      return true
    }
  }
  return false
}

/**
 * Spam SEO link targets injected in an earlier compromise (audit §1: essay-writing sites such as
 * lawessaywritingservice.org, us.grademiners.com). Matched anywhere in the host name.
 */
export const SPAM_LINK =
  /(?:essay|paper|assignment|homework|dissertation|thesis|coursework|grademiner|writingservice)/i

/**
 * The ONLY outside sites migrated content may link to — reviewed from the complete outbound-link
 * inventory of the snapshot (verify.ts lists it on every run). Any other outbound link is removed
 * (its text stays) and reported, so an injected link can never ride along into the new site.
 * Subdomains are included (m.facebook.com, hajj.islamonlive.in). Extend only after review.
 */
export const APPROVED_LINK_HOSTS = [
  'youtube.com',
  'youtu.be',
  'docs.google.com',
  'facebook.com',
  'islamonlive.in',
]

export function isApprovedLinkHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return APPROVED_LINK_HOSTS.some((a) => h === a || h.endsWith(`.${a}`))
}

/** Roots of the knowledge-base tree (audit §3): everything under them is migrated as `kb`. */
export const KB_ROOT_IDS = new Set([269, 483, 488, 527, 530, 532, 571, 602, 625, 687, 715, 755])
/** Real standalone pages: about, postal library, free Qur'an, quiz. */
export const STATIC_PAGE_IDS = new Set([220, 814, 918, 1691])

export type PageKind = 'kb' | 'static' | 'demo'

/**
 * kb / static / demo for every page. Demo = the theme's sample pages (typography, grid, portfolio,
 * gallery, contact, `-2`/`-3` duplicates, the builder "home"); they are not migrated and answer 410.
 */
export function classifyPages(pages: Pick<WpPage, 'id' | 'parent'>[]): Map<number, PageKind> {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const out = new Map<number, PageKind>()
  for (const page of pages) {
    let current: Pick<WpPage, 'id' | 'parent'> | undefined = page
    const seen = new Set<number>()
    while (current?.parent && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parent)
    }
    const kind: PageKind =
      current && KB_ROOT_IDS.has(current.id)
        ? 'kb'
        : STATIC_PAGE_IDS.has(page.id)
          ? 'static'
          : 'demo'
    out.set(page.id, kind)
  }
  return out
}

export function isDemoPost(post: Pick<WpPost, 'categories'>): boolean {
  return post.categories.length > 0 && post.categories.every((c) => DEMO_CATEGORY_IDS.has(c))
}

/**
 * Dates the audit found tampered (bulk-rewritten to 2026-07-02 during the compromise) or corrupt
 * (year 0020). Anything after the snapshot date is also suspect.
 */
export function isSuspectDate(iso: string, snapshotAt = '2026-09-29'): boolean {
  if (!iso || /^0\d{3}-/.test(iso)) return true
  return iso.startsWith('2026-07-02') || iso.slice(0, 10) > snapshotAt
}
