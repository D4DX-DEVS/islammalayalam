import { normalizeSlug } from '@/lib/text/slug'
import type { WpPage, WpPost } from '../lib/snapshot'
import { isSuspectDate } from '../lib/exclusions'

/**
 * Site paths computed from the WordPress data itself, so links can be rewritten before (or without)
 * the target documents existing: pages keep their hierarchical path (segments normalised the same
 * way the CMS normalises slugs), categories live under /category/<slug>/.
 */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

/** WordPress page id → /a/b/c/ (null for pages whose chain is broken or cyclic). */
export function pagePaths(pages: Pick<WpPage, 'id' | 'slug' | 'parent'>[]): Map<number, string> {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const out = new Map<number, string>()
  for (const page of pages) {
    const segments: string[] = []
    const seen = new Set<number>()
    let current: (typeof pages)[number] | undefined = page
    let broken = false
    while (current) {
      if (seen.has(current.id)) {
        broken = true // cycle
        break
      }
      seen.add(current.id)
      segments.unshift(normalizeSlug(decodeSlug(current.slug)))
      if (!current.parent) break
      current = byId.get(current.parent)
      if (!current) broken = true // parent missing (trashed or never published)
    }
    if (!broken && segments.every(Boolean)) out.set(page.id, `/${segments.join('/')}/`)
  }
  return out
}

/**
 * Publish date for a post whose WordPress date was tampered with or corrupt: the date of the
 * nearest earlier post by id (ids grow with time on this site), else the nearest later one.
 * The post is flagged `dateSuspect` for an editor to confirm.
 */
export function repairedDate(
  post: Pick<WpPost, 'id'>,
  all: Pick<WpPost, 'id' | 'date_gmt'>[],
): string {
  const sane = all
    .filter((p) => !isSuspectDate(p.date_gmt) && p.id !== post.id)
    .sort((a, b) => a.id - b.id)
  const before = sane.filter((p) => p.id < post.id).at(-1)
  const after = sane.find((p) => p.id > post.id)
  const pick = before ?? after
  return pick ? toIso(pick.date_gmt) : new Date('2019-01-01T00:00:00Z').toISOString()
}

/** WordPress `date_gmt` ("2020-02-08T15:23:45", no zone) → ISO string in UTC. */
export function toIso(dateGmt: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(dateGmt) ? dateGmt : `${dateGmt}Z`)
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString()
}
