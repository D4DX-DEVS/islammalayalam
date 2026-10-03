import type { CollectionSlug, Where } from 'payload'
import { normalizeSlug } from '@/lib/text/slug'
import { DEMO_CATEGORY_IDS, HIDDEN_CATEGORY_IDS, SLIDER_CATEGORY_ID } from '../lib/exclusions'
import { retryOnce } from '../lib/retry'
import { hashOf, type Entity, type Run } from '../lib/run'
import type { WpCategory } from '../lib/snapshot'
import { htmlToText } from '../lib/text'
import { decodeSlug } from '../transform/paths'

/**
 * Categories and the public byline. Upserted by `legacy.wpId` (authors by slug); a record whose
 * computed data is unchanged since the last run is left alone (idempotent re-runs).
 */

/** Homepage/menu order of the original site (lower first); anything else sorts after. */
const ORDER: Record<string, number> = {
  news: 10,
  ചോദ്യോത്തരം: 20,
  ലേഖനം: 30,
  കാഴ്ചപ്പാട്: 40,
  videos: 50,
  audios: 60,
  'e-books': 70,
  'സൗജന്യ-പുസ്തകം': 80,
  'പ്രകാശം-പരത്തിയ-പ്രവാചകൻ': 90,
}

export const SITE_AUTHOR = { name: 'Islam Malayalam', slug: 'islam-malayalam' }

export type UpsertStatus = 'created' | 'updated' | 'unchanged'

/** Saved again more than a minute after the migration wrote it (the migration's own write is instant). */
export function editedAfterMigration(doc: {
  updatedAt?: string
  legacy?: { migratedAt?: string | null } | null
}): boolean {
  const migrated = Date.parse(doc.legacy?.migratedAt ?? '')
  const updated = Date.parse(doc.updatedAt ?? '')
  return Number.isFinite(migrated) && Number.isFinite(updated) && updated - migrated > 60_000
}

/** Create or update one document identified by `where`; `data.legacy.sourceHash` decides "unchanged". */
export async function upsert(
  run: Run,
  entity: Entity,
  collection: CollectionSlug,
  where: Where,
  data: Record<string, unknown> & { legacy?: Record<string, unknown> },
  opts: { draft?: boolean } = {},
): Promise<{ id: string; status: UpsertStatus }> {
  const { payload } = run
  const sourceHash = hashOf({ ...data, legacy: { ...data.legacy, migratedAt: undefined } })
  const payloadData = {
    ...data,
    legacy: { ...data.legacy, sourceHash, migratedAt: new Date().toISOString() },
  }
  const found = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    draft: opts.draft,
    overrideAccess: true,
    pagination: false,
  })
  const existing = found.docs[0] as
    | {
        id: string
        updatedAt?: string
        legacy?: { sourceHash?: string | null; migratedAt?: string | null } | null
      }
    | undefined
  if (existing && existing.legacy?.sourceHash === sourceHash) {
    run.tally(entity, 'unchanged')
    return { id: String(existing.id), status: 'unchanged' }
  }
  if (existing && editedAfterMigration(existing) && !run.overwriteEdited) {
    // Someone changed it in the CMS: their version wins over a re-run.
    run.tally(entity, 'unchanged')
    run.issue({
      entity,
      wpId: typeof data.legacy?.wpId === 'number' ? data.legacy.wpId : undefined,
      gate: 'validation',
      severity: 'warning',
      summary: 'edited in the CMS after migration: kept as the editor saved it',
    })
    return { id: String(existing.id), status: 'unchanged' }
  }
  const retry = {
    // Worth knowing if it keeps happening, but nothing for an editor to fix.
    onRecovered: () =>
      run.issue({
        entity,
        wpId: typeof data.legacy?.wpId === 'number' ? data.legacy.wpId : undefined,
        gate: 'validation',
        severity: 'warning',
        summary: 'saved on the second try (database transaction race)',
      }),
  }
  if (run.dryRun) {
    run.tally(entity, existing ? 'updated' : 'created')
    return {
      id: existing ? String(existing.id) : `dry-run:${entity}`,
      status: existing ? 'updated' : 'created',
    }
  }
  if (existing) {
    await retryOnce(() =>
      payload.update({
        collection,
        id: existing.id,
        data: payloadData as never,
        overrideAccess: true,
        context: run.context,
      }),
      retry,
    )
    run.tally(entity, 'updated')
    return { id: String(existing.id), status: 'updated' }
  }
  const created = await retryOnce(() =>
    payload.create({
      collection,
      data: payloadData as never,
      overrideAccess: true,
      context: run.context,
    }),
    retry,
  )
  run.tally(entity, 'created')
  return { id: String(created.id), status: 'created' }
}

/** WordPress category id → migrated category id (demo and `slider` are not categories any more). */
export async function migrateCategories(
  run: Run,
  categories: WpCategory[],
): Promise<Map<number, { id: string; slug: string }>> {
  const map = new Map<number, { id: string; slug: string }>()
  for (const c of categories) {
    run.tally('category', 'source')
    if (DEMO_CATEGORY_IDS.has(c.id) || c.id === SLIDER_CATEGORY_ID) {
      run.tally('category', 'excluded')
      continue
    }
    const original = decodeSlug(c.slug)
    const slug = normalizeSlug(original)
    const data = {
      name: htmlToText(c.name).slice(0, 120),
      slug,
      description: htmlToText(c.description).slice(0, 600) || undefined,
      order: ORDER[slug] ?? 500,
      hidden: HIDDEN_CATEGORY_IDS.has(c.id),
      legacy: { wpId: c.id, legacySlugs: original !== slug ? [original] : [] },
    }
    const { id } = await upsert(
      run,
      'category',
      'categories',
      { 'legacy.wpId': { equals: c.id } },
      data,
    )
    map.set(c.id, { id, slug })
    if (original !== slug)
      run.issue({
        entity: 'category',
        wpId: c.id,
        gate: 'validation',
        severity: 'warning',
        summary: `slug normalised (invisible characters removed); old URL redirects: ${slug}`,
      })
  }
  return map
}

/** One public byline for all migrated posts (the WordPress accounts were "admin" and "editor"). */
export async function migrateAuthor(run: Run): Promise<string> {
  run.tally('author', 'source')
  const { id } = await upsert(
    run,
    'author',
    'authors',
    { slug: { equals: SITE_AUTHOR.slug } },
    { name: SITE_AUTHOR.name, slug: SITE_AUTHOR.slug, legacy: {} },
  )
  return id
}
