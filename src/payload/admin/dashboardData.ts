import 'server-only'
import type { Payload, Where } from 'payload'
import { hasRole } from '@/payload/access'

/**
 * Data for the editorial dashboard. Every query runs AS the signed-in user (`overrideAccess: false`)
 * so collection/field access and the TOTP wrapper apply exactly as they do in the REST API; a
 * session that may not read something gets zeros/empty lists (`disableErrors`), never a leak.
 */
type DashboardUser = { id: string | number; role?: string | null } & Record<string, unknown>

export type DashboardRow = {
  id: string
  title: string
  updatedAt: string
  postNumber: number | null
  status: 'draft' | 'published'
}

export type DashboardStats = {
  published: number
  drafts: number
  needsReview: number
  pages: number
  media: number
}

export type DashboardData = {
  /** Authors only see (and are counted on) their own drafts. */
  ownDraftsOnly: boolean
  stats: DashboardStats
  drafts: DashboardRow[]
  review: DashboardRow[]
}

const LIST_LIMIT = 6
const ROW_SELECT = { title: true, updatedAt: true, postNumber: true, _status: true } as const

function toRow(doc: Record<string, unknown>): DashboardRow {
  return {
    id: String(doc.id),
    title: typeof doc.title === 'string' && doc.title ? doc.title : '(untitled)',
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : '',
    postNumber: typeof doc.postNumber === 'number' ? doc.postNumber : null,
    status: doc._status === 'published' ? 'published' : 'draft',
  }
}

export async function loadDashboard(payload: Payload, user: DashboardUser): Promise<DashboardData> {
  const as = { user, overrideAccess: false, disableErrors: true } as const
  const ownDraftsOnly = !hasRole(user as never, 'admin', 'editor')
  const draftWhere: Where = ownDraftsOnly
    ? { and: [{ _status: { equals: 'draft' } }, { createdBy: { equals: user.id } }] }
    : { _status: { equals: 'draft' } }
  const reviewWhere: Where = { 'flags.needsReview': { equals: true } }

  const [published, drafts, needsReview, pages, media, draftList, reviewList] = await Promise.all([
    payload.count({ collection: 'posts', where: { _status: { equals: 'published' } }, ...as }),
    payload.count({ collection: 'posts', where: draftWhere, ...as }),
    payload.count({ collection: 'posts', where: reviewWhere, ...as }),
    payload.count({ collection: 'pages', ...as }),
    payload.count({ collection: 'media', ...as }),
    payload.find({
      collection: 'posts',
      where: draftWhere,
      sort: '-updatedAt',
      limit: LIST_LIMIT,
      depth: 0,
      draft: true,
      select: ROW_SELECT,
      pagination: false,
      ...as,
    }),
    payload.find({
      collection: 'posts',
      where: reviewWhere,
      sort: '-updatedAt',
      limit: LIST_LIMIT,
      depth: 0,
      select: ROW_SELECT,
      pagination: false,
      ...as,
    }),
  ])

  return {
    ownDraftsOnly,
    stats: {
      published: published.totalDocs,
      drafts: drafts.totalDocs,
      needsReview: needsReview.totalDocs,
      pages: pages.totalDocs,
      media: media.totalDocs,
    },
    drafts: draftList.docs.map((d) => toRow(d as Record<string, unknown>)),
    review: reviewList.docs.map((d) => toRow(d as Record<string, unknown>)),
  }
}
