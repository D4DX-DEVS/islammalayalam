import { findIocs } from '@/lib/security/ioc'
import { validateLexical } from '@/lib/security/lexical-guard'
import { normalizePath, toPath } from '@/lib/text/slug'
import { isApprovedLinkHost, isRedirectLink, OWN_HOSTS } from './lib/exclusions'
import type { Run, Tally } from './lib/run'
import { fileLink } from './load/content'

/**
 * Gate C — verification of what is actually stored in the target database (not of what the run
 * believes it wrote): counts, indicator scan, content-guard re-check, references and internal links.
 * Security checks are blocking: a failure marks the run failed.
 */
type Doc = Record<string, unknown> & { id: string | number }
type LexNode = Record<string, unknown> & { type?: string; children?: LexNode[] }
const BLOCKS = new Set(['youtube'])

function walk(node: unknown, visit: (n: LexNode) => void): void {
  if (!node || typeof node !== 'object') return
  const n = node as LexNode
  visit(n)
  if (Array.isArray(n.children)) n.children.forEach((c) => walk(c, visit))
}

const richFields = (doc: Doc): unknown[] => [
  doc.content,
  doc.intro,
  ...(Array.isArray(doc.sections) ? doc.sections.map((s) => (s as Doc).content) : []),
]

const migrated = (t?: Tally): number => (t ? t.created + t.updated + t.unchanged : 0)

/** A site path as it may appear in a report: URL-encoded, plain characters only, shortened. */
const reportUrl = (url: string): string =>
  encodeURI(url)
    .replace(/[^A-Za-z0-9._~%/?=&#-]/g, '_')
    .slice(0, 80)

export async function verifyTarget(
  run: Run,
  expected: { posts?: Tally; pages?: Tally },
): Promise<void> {
  const { payload } = run
  const all = async (collection: 'posts' | 'pages' | 'categories' | 'media' | 'redirects') =>
    (
      await payload.find({
        collection,
        limit: 0,
        depth: 0,
        overrideAccess: true,
        pagination: false,
        showHiddenFields: true,
      })
    ).docs as unknown as Doc[]
  const [posts, pages, categories, media, redirects] = await Promise.all([
    all('posts'),
    all('pages'),
    all('categories'),
    all('media'),
    all('redirects'),
  ])
  const legacyCount = (docs: Doc[]) =>
    docs.filter((d) => (d.legacy as { wpId?: number } | undefined)?.wpId).length

  // 1. Counts.
  const postCount = legacyCount(posts)
  const pageCount = legacyCount(pages)
  run.check(
    'Posts stored = posts migrated',
    postCount === migrated(expected.posts),
    `${postCount} in database, ${migrated(expected.posts)} expected`,
  )
  run.check(
    'Pages stored = pages migrated',
    pageCount === migrated(expected.pages),
    `${pageCount} in database, ${migrated(expected.pages)} expected`,
  )

  // 2. Indicator scan over every stored document (blocking).
  const infected = [...posts, ...pages, ...categories, ...media, ...redirects]
    .map((d) => ({ id: d.id, iocs: findIocs(JSON.stringify(d)) }))
    .filter((d) => d.iocs.length)
  run.check(
    'No malware indicators in any stored document',
    infected.length === 0,
    infected.length
      ? `${infected.length} documents: ${infected
          .slice(0, 10)
          .map((d) => `${d.id} (${d.iocs.join(',')})`)
          .join('; ')}`
      : `${posts.length + pages.length + categories.length + media.length + redirects.length} documents scanned`,
    true,
  )

  // 3. Content guard re-check on stored rich text (blocking).
  const invalid = [...posts, ...pages].filter((d) =>
    richFields(d).some((state) => validateLexical(state, BLOCKS).length > 0),
  )
  run.check(
    'All stored rich text passes the content guard',
    invalid.length === 0,
    invalid.length ? `invalid: ${invalid.map((d) => d.id).join(', ')}` : 'ok',
    true,
  )

  // 4. References: images in text, featured images, PDF attachments.
  const mediaIds = new Set(media.map((m) => String(m.id)))
  const missingRefs: string[] = []
  for (const d of [...posts, ...pages]) {
    const refs: unknown[] = [d.featuredImage]
    for (const a of (d.attachments as Array<{ file?: unknown }> | undefined) ?? [])
      refs.push(a.file)
    for (const state of richFields(d))
      walk((state as { root?: unknown } | undefined)?.root, (n) => {
        if (n.type === 'upload') refs.push(n.value)
      })
    for (const r of refs)
      if (r && !mediaIds.has(String(typeof r === 'object' ? (r as Doc).id : r)))
        missingRefs.push(`${String(d.id)}→${String(r)}`)
  }
  run.check(
    'Every image / file reference points at a stored file',
    missingRefs.length === 0,
    missingRefs.length ? missingRefs.slice(0, 10).join(', ') : 'ok',
  )

  // 5. Internal links resolve on the new site.
  const numbers = new Set(posts.map((p) => String(p.postNumber)))
  const pagePaths = new Set(pages.map((p) => `/${String(p.path)}/`))
  const categoryPaths = new Set(categories.map((c) => `/category/${String(c.slug)}/`))
  const redirectFrom = new Set(redirects.map((r) => String(r.from)))
  const legacySlugs = new Set(
    posts.flatMap((p) => (p.legacy as { legacySlugs?: string[] } | undefined)?.legacySlugs ?? []),
  )
  // Stored files, as content must link to them: a site path, or the CDN's https address.
  const files = new Set(
    media.flatMap((m) => {
      const link = fileLink(String(m.url ?? ''))
      return link ? [link] : []
    }),
  )
  const broken = new Map<string, number>()
  const resolves = (url: string): boolean => {
    const [path] = url.split(/[?#]/)
    if (!path || path === '/' || path.startsWith('/search')) return true
    if (files.has(path)) return true
    const segments = normalizePath(path)
    if (!segments) return false
    const canonical = toPath(segments)
    if (segments.length === 1 && numbers.has(segments[0]!)) return true
    return (
      pagePaths.has(canonical) ||
      categoryPaths.has(canonical) ||
      redirectFrom.has(canonical) ||
      (segments.length === 1 && legacySlugs.has(segments[0]!))
    )
  }
  for (const d of [...posts, ...pages])
    for (const state of richFields(d))
      walk((state as { root?: unknown } | undefined)?.root, (n) => {
        const url = (n.fields as { url?: unknown } | undefined)?.url
        if (n.type !== 'link' || typeof url !== 'string' || !url.startsWith('/')) return
        if (!resolves(url)) broken.set(url, (broken.get(url) ?? 0) + 1)
      })
  run.check(
    'Internal links resolve',
    broken.size === 0,
    broken.size
      ? `${broken.size} distinct targets not found, e.g. ${[...broken.keys()]
          .slice(0, 8)
          .map(reportUrl)
          .join(' ')}`
      : 'ok',
  )

  // 6. Outbound links: never back into the old WordPress site, never through a redirect service,
  //    only to approved sites, only https. Links to our own stored files (CDN) are ours.
  const oldSite: string[] = []
  const redirecting: string[] = []
  const unapproved: string[] = []
  const plainHttp: string[] = []
  const hosts = new Map<string, number>()
  for (const d of [...posts, ...pages])
    for (const state of richFields(d))
      walk((state as { root?: unknown } | undefined)?.root, (n) => {
        const url = (n.fields as { url?: unknown } | undefined)?.url
        if (n.type !== 'link' || typeof url !== 'string') return
        if (url.startsWith('/')) {
          if (/^\/wp-|\.php(?:$|[?#/])/i.test(url)) oldSite.push(String(d.id))
          return
        }
        let target: URL
        try {
          target = new URL(url)
        } catch {
          return
        }
        if (!/^https?:$/.test(target.protocol)) return
        if (target.protocol === 'https:' && files.has(url)) return // our own file on the CDN
        const host = target.hostname.toLowerCase()
        if (OWN_HOSTS.has(host)) oldSite.push(String(d.id))
        else if (isRedirectLink(target)) redirecting.push(String(d.id))
        else if (!isApprovedLinkHost(host)) unapproved.push(String(d.id))
        if (target.protocol === 'http:') plainHttp.push(String(d.id))
        hosts.set(host, (hosts.get(host) ?? 0) + 1)
      })
  run.check(
    'No link leads to the old WordPress site',
    oldSite.length === 0,
    oldSite.length ? `in documents ${[...new Set(oldSite)].slice(0, 10).join(', ')}` : 'ok',
    true,
  )
  run.check(
    'No link goes through a redirect or short-link service',
    redirecting.length === 0,
    redirecting.length ? `in documents ${[...new Set(redirecting)].slice(0, 10).join(', ')}` : 'ok',
    true,
  )
  run.check(
    'Outbound links go only to approved sites',
    unapproved.length === 0,
    unapproved.length ? `in documents ${[...new Set(unapproved)].slice(0, 10).join(', ')}` : 'ok',
    true,
  )
  run.check(
    'Outbound links use https',
    plainHttp.length === 0,
    plainHttp.length ? `${plainHttp.length} http links` : 'ok',
    true,
  )
  run.check(
    'External sites linked (for review)',
    true,
    [...hosts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([h, n]) => `${h.replace(/[^a-z0-9.-]/g, '_')} (${n})`)
      .join(', ') || 'none',
  )

  // 7. Editorial follow-ups (informational).
  const noAlt = media.filter(
    (m) => String(m.mimeType ?? '').startsWith('image/') && !String(m.alt ?? '').trim(),
  ).length
  run.check(
    'Images with alt text',
    noAlt === 0,
    `${noAlt} of ${media.length} files have no alt text`,
  )
  const unpublished = posts.filter((p) => p._status !== 'published' || !p.publishedAt).length
  run.check('Posts published with a date', unpublished === 0, `${unpublished} without`)
  const flagged = [...posts, ...pages].filter(
    (d) => (d.flags as { needsReview?: boolean })?.needsReview,
  )
  run.check(
    'Flagged for editor review',
    true,
    `${flagged.length} documents (Admin → filter "Needs review")`,
  )
}
