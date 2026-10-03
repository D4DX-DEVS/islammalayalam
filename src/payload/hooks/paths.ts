import { APIError } from 'payload'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, PayloadRequest } from 'payload'

/**
 * Hierarchical URLs for knowledge-base pages (e.g. /kb/salah/wudu/) and automatic 301s when a
 * published URL changes, so moving or renaming content never breaks inbound links (SEO rule).
 * `path` is stored without leading/trailing slashes: "kb/salah/wudu".
 */
type Doc = Record<string, unknown> & { id?: string | number }
const MAX_DEPTH = 8
const relId = (v: unknown): string | number | null =>
  v && typeof v === 'object' ? ((v as Doc).id ?? null) : ((v as string | number | null) ?? null)

export const computePagePath: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const doc: Doc = { ...(originalDoc ?? {}), ...data }
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  if (!slug) return data
  const parentId = relId(doc.parent)
  if (!parentId) return { ...data, path: slug }
  if (originalDoc?.id && String(parentId) === String(originalDoc.id))
    throw new APIError('A page cannot be its own parent', 400, undefined, true)

  const parent = (await req.payload.findByID({
    collection: 'pages',
    id: parentId,
    depth: 0,
    draft: true,
    overrideAccess: true,
    req,
  })) as unknown as Doc
  const parentPath = typeof parent?.path === 'string' ? parent.path : ''
  const ownPath = typeof originalDoc?.path === 'string' ? originalDoc.path : null
  if (ownPath && (parentPath === ownPath || parentPath.startsWith(`${ownPath}/`))) {
    throw new APIError(
      'A page cannot be moved under one of its own sub-pages',
      400,
      undefined,
      true,
    )
  }
  if (parentPath.split('/').length >= MAX_DEPTH)
    throw new APIError(`Pages can be nested at most ${MAX_DEPTH} levels`, 400, undefined, true)
  return { ...data, path: `${parentPath}/${slug}` }
}

/** Upsert a 301 old → new, collapse chains that pointed at the old URL, and drop loops. */
export async function recordMove(req: PayloadRequest, from: string, to: string): Promise<void> {
  if (from === to) return
  const common = { collection: 'redirects' as const, overrideAccess: true, req, depth: 0 }
  await req.payload.delete({ ...common, where: { from: { equals: to } } })
  await req.payload.update({ ...common, where: { to: { equals: from } }, data: { to } })
  const existing = await req.payload.find({
    ...common,
    where: { from: { equals: from } },
    limit: 1,
    pagination: false,
  })
  if (existing.docs[0])
    await req.payload.update({ ...common, id: existing.docs[0].id, data: { to, code: '301' } })
  else await req.payload.create({ ...common, data: { from, to, code: '301', source: 'auto' } })
}

const isPublished = (doc: Doc | undefined): boolean =>
  !doc || !('_status' in doc) || doc._status === 'published'

/** After a published page moves: redirect its old URL and re-save children so their paths follow. */
export const cascadePagePath: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const before = typeof previousDoc?.path === 'string' ? previousDoc.path : null
  if (!before || before === doc.path || !isPublished(doc)) return doc
  await recordMove(req, `/${before}/`, `/${doc.path}/`)
  const children = await req.payload.find({
    collection: 'pages',
    where: { parent: { equals: doc.id } },
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
  })
  for (const child of children.docs) {
    await req.payload.update({
      collection: 'pages',
      id: child.id,
      data: {},
      overrideAccess: true,
      req,
    })
  }
  return doc
}

/** Categories live at /category/<slug>/ — renaming a slug leaves a 301 behind. */
export const redirectOnSlugChange =
  (prefix: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req }) => {
    const before = typeof previousDoc?.slug === 'string' ? previousDoc.slug : null
    if (before && before !== doc.slug && isPublished(doc))
      await recordMove(req, `/${prefix}/${before}/`, `/${prefix}/${doc.slug}/`)
    return doc
  }
