import { APIError } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'
import { hasRole } from '@/payload/access'
import { lexicalToPlainText } from '@/lib/security/lexical-guard'
import { youtubeId } from '@/lib/security/url'
import { searchKey } from '@/lib/text/search'
import { SEARCH_TEXT_LIMIT } from '@/payload/fields'

type Doc = Record<string, unknown>
const WORDS_PER_MINUTE = 180

/** createdBy is server-owned: set once on create from the session, never from input. */
export const setCreatedBy: CollectionBeforeChangeHook = ({ data, operation, req, originalDoc }) => {
  if (operation === 'create') return { ...data, createdBy: req.user?.id ?? null }
  return { ...data, createdBy: originalDoc?.createdBy ?? null }
}

/**
 * Authors may write drafts only; publishing needs an editor or admin. A non-draft save without
 * `_status` keeps the stored status, so editing an already-published doc counts as publishing.
 */
export const authorCannotPublish: CollectionBeforeChangeHook = ({ data, req, originalDoc }) => {
  const user = req.user as Parameters<typeof hasRole>[0]
  const status = data?._status ?? originalDoc?._status
  if (user && status === 'published' && !hasRole(user, 'admin', 'editor')) {
    throw new APIError(
      'Authors cannot publish. Save a draft and ask an editor to review it.',
      403,
      undefined,
      true,
    )
  }
  return data
}

/** New posts continue the WordPress numeric-ID sequence so /<number>/ URLs never collide. */
export const assignPostNumber: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || typeof data?.postNumber === 'number') return data
  const last = await req.payload.find({
    collection: 'posts',
    sort: '-postNumber',
    limit: 1,
    depth: 0,
    draft: true,
    overrideAccess: true,
    pagination: false,
    select: { postNumber: true },
    req,
  })
  const max = (last.docs[0] as Doc | undefined)?.postNumber
  return { ...data, postNumber: (typeof max === 'number' ? max : 0) + 1 }
}

/**
 * Derived, server-computed fields for posts: search text, reading time, YouTube id, primary category.
 * Partial updates only carry changed fields, so values are computed from the merged document.
 */
export const derivePostFields: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const doc: Doc = { ...(originalDoc ?? {}), ...data }
  const plain = lexicalToPlainText(doc.content)
  const words = plain.split(/\s+/).filter(Boolean).length
  const searchText = [doc.title, doc.excerpt, plain]
    .filter((v) => typeof v === 'string' && v)
    .join('\n')
    .slice(0, SEARCH_TEXT_LIMIT)

  const video = (doc.video ?? {}) as Doc
  const videoUrl = typeof video.url === 'string' ? video.url : ''
  const categories = Array.isArray(doc.categories) ? doc.categories : []
  return {
    ...data,
    searchText,
    searchKey: searchKey(doc.title as string, doc.excerpt as string),
    readingMinutes: words ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : null,
    video: { ...video, youtubeId: videoUrl ? youtubeId(videoUrl) : null },
    primaryCategory: doc.primaryCategory ?? categories[0] ?? null,
  }
}

/** Search text for knowledge-base pages: title, intro and every section. */
export const derivePageFields: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const doc: Doc = { ...(originalDoc ?? {}), ...data }
  const sections = Array.isArray(doc.sections) ? (doc.sections as Doc[]) : []
  const parts = [
    doc.title,
    lexicalToPlainText(doc.intro),
    ...sections.flatMap((s) => [s.title, lexicalToPlainText(s.content)]),
  ]
  return {
    ...data,
    searchText: parts
      .filter((v) => typeof v === 'string' && v)
      .join('\n')
      .slice(0, SEARCH_TEXT_LIMIT),
    searchKey: searchKey(doc.title as string, lexicalToPlainText(doc.intro)),
  }
}
