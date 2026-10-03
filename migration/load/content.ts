import { htmlToLexical, imageSources, linkHrefs, type ConvertResult } from '../transform/lexical'
import { keyOf, type MediaMigrator, type MigratedMedia } from './media'

/**
 * Shared by posts and pages: which uploads a piece of (already gated) HTML references, their
 * migrated files, and the HTML → Lexical conversion wired to those files and to the new URL scheme.
 */
export type ContentDeps = {
  categories: Map<number, { id: string; slug: string }>
  /** Migrated pages only: links to demo pages are unwrapped. */
  pagePaths: Map<number, string>
  media: MediaMigrator
}

/** Upload URLs (images and linked files) on this site referenced by the HTML. */
export const uploadRefs = (html: string): string[] =>
  [...imageSources(html), ...linkHrefs(html)].filter((u) => keyOf(u) !== null)

/** Migrated file per upload key (migrating on first use; already done in the media stage). */
export async function resolveMedia(
  media: MediaMigrator,
  htmls: string[],
  forWpId: number,
): Promise<Map<string, MigratedMedia>> {
  const resolved = new Map<string, MigratedMedia>()
  for (const src of htmls.flatMap(uploadRefs)) {
    const m = await media.ensure(src, forWpId)
    if (m) resolved.set(keyOf(src)!, m)
  }
  return resolved
}

export function convert(
  html: string,
  seed: string,
  resolved: Map<string, MigratedMedia>,
  deps: ContentDeps,
): ConvertResult {
  return htmlToLexical(html, {
    seed,
    image: (src) => {
      const m = resolved.get(keyOf(src) ?? '')
      return m && m.kind.startsWith('image/') ? { mediaId: m.id } : null
    },
    uploadUrl: (key) => fileLink(resolved.get(key)?.url),
    pagePath: (id) => deps.pagePaths.get(id) ?? null,
    categoryPath: (id) => {
      const c = deps.categories.get(id)
      return c ? `/category/${c.slug}/` : null
    },
  })
}

/**
 * How content links to a stored file: files served by the app itself become a site path
 * ("/api/media/file/x.pdf", valid on every host — Payload reports them with the server origin of
 * whoever ran the migration); files on the CDN keep their https address. Anything else: no link.
 */
export function fileLink(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/api/media/file/')) return url
  try {
    const u = new URL(url)
    if (u.pathname.startsWith('/api/media/file/')) return `${u.pathname}${u.search}`
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Review notes for links that were taken out (their text stays), one per reason. */
export function removedLinksNotes(results: ConvertResult[]): string[] {
  const counts = new Map<string, number>()
  for (const w of results.flatMap((r) => r.warnings)) {
    const reason = /^link removed \((redirect|spam|not-approved|dead-host|unsafe)\)$/.exec(w)?.[1]
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const label: Record<string, string> = {
    redirect: 'went through a redirect or short-link service',
    spam: 'pointed at a spam site',
    'not-approved': 'pointed at an outside site that is not on the approved list',
    'dead-host': 'pointed at a site that no longer exists',
    unsafe: 'used an unsafe address',
  }
  return [...counts].map(([reason, n]) => `link removed, text kept: ${label[reason]} (${n})`)
}

/** Review note for images that could not be kept (dead hosts, quarantined files). */
export function droppedImagesNote(result: ConvertResult): string | null {
  const n = result.warnings.filter((w) => w.startsWith('image not migrated')).length
  return n ? `${n} image(s) could not be kept (dead host or failed file checks)` : null
}
