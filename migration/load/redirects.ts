import { normalizePath, toPath } from '@/lib/text/slug'
import { DEMO_CATEGORY_IDS, isDemoPost, SLIDER_CATEGORY_ID, type PageKind } from '../lib/exclusions'
import type { Run } from '../lib/run'
import type { WpCategory, WpPost } from '../lib/snapshot'
import { decodeSlug } from '../transform/paths'

/**
 * Redirect rows for URLs of the old site that have no new content: theme demo pages, posts and
 * categories answer 410 Gone (search engines drop them quickly); `/category/slider/` was a
 * homepage placement, so it goes to the homepage. Everything else keeps its URL, or is redirected
 * by the router itself (legacy post slugs, old chillu spellings).
 */
export type RedirectRow = { from: string; code: '301' | '410'; to?: string }

export function plannedRedirects(input: {
  posts: Pick<WpPost, 'id' | 'categories'>[]
  categories: Pick<WpCategory, 'id' | 'slug'>[]
  kinds: Map<number, PageKind>
  allPagePaths: Map<number, string>
}): RedirectRow[] {
  const rows = new Map<string, RedirectRow>()
  const add = (raw: string, code: RedirectRow['code'], to?: string) => {
    const segments = normalizePath(raw)
    if (!segments?.length) return
    const from = toPath(segments)
    if (!rows.has(from)) rows.set(from, to ? { from, code, to } : { from, code })
  }
  for (const [id, kind] of input.kinds) {
    const path = input.allPagePaths.get(id)
    if (kind === 'demo' && path) add(path, '410')
  }
  for (const p of input.posts) if (isDemoPost(p)) add(`/${p.id}/`, '410')
  for (const c of input.categories) {
    const path = `/category/${decodeSlug(c.slug)}/`
    if (c.id === SLIDER_CATEGORY_ID) add(path, '301', '/')
    else if (DEMO_CATEGORY_IDS.has(c.id)) add(path, '410')
  }
  return [...rows.values()]
}

export async function migrateRedirects(run: Run, rows: RedirectRow[]): Promise<void> {
  const { payload } = run
  for (const row of rows) {
    run.tally('redirect', 'source')
    const found = await payload.find({
      collection: 'redirects',
      where: { from: { equals: row.from } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    })
    const existing = found.docs[0] as { id: string; to?: string | null; code?: string } | undefined
    if (existing && existing.code === row.code && (existing.to ?? undefined) === row.to) {
      run.tally('redirect', 'unchanged')
      continue
    }
    if (existing && (existing as { source?: string }).source !== 'migration') {
      // An editor changed or created this redirect: theirs wins.
      run.tally('redirect', 'unchanged')
      continue
    }
    if (run.dryRun) {
      run.tally('redirect', existing ? 'updated' : 'created')
      continue
    }
    const data = {
      from: row.from,
      code: row.code,
      to: row.to ?? null,
      source: 'migration' as const,
    }
    if (existing)
      await payload.update({
        collection: 'redirects',
        id: existing.id,
        data,
        overrideAccess: true,
        context: run.context,
      })
    else
      await payload.create({
        collection: 'redirects',
        data,
        overrideAccess: true,
        context: run.context,
      })
    run.tally('redirect', existing ? 'updated' : 'created')
  }
}
