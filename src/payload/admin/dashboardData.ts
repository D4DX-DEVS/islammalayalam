import 'server-only'
import type { Payload, Where } from 'payload'
import { hasRole } from '@/payload/access'

/**
 * Data for the admin dashboard. Every query runs AS the signed-in user (`overrideAccess: false`)
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
  newMessages: number
}

export type CategoryCount = { id: string; name: string; posts: number }
export type MessageRow = {
  id: string
  name: string
  subject: string
  createdAt: string
  status: string
}
export type ActivityRow = {
  id: string
  action: string
  target: string
  docId: string
  who: string
  createdAt: string
}

export type DashboardData = {
  /** Authors only see (and are counted on) their own drafts. */
  ownDraftsOnly: boolean
  stats: DashboardStats
  drafts: DashboardRow[]
  published: DashboardRow[]
  review: DashboardRow[]
  categories: CategoryCount[]
  messages: MessageRow[]
  activity: ActivityRow[]
}

const LIST_LIMIT = 6
const ROW_SELECT = { title: true, updatedAt: true, postNumber: true, _status: true } as const

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

function toRow(doc: Record<string, unknown>): DashboardRow {
  return {
    id: String(doc.id),
    title: str(doc.title) || '(untitled)',
    updatedAt: str(doc.updatedAt),
    postNumber: typeof doc.postNumber === 'number' ? doc.postNumber : null,
    status: doc._status === 'published' ? 'published' : 'draft',
  }
}

function toActivity(doc: Record<string, unknown>): ActivityRow {
  const user = doc.user as { email?: string; name?: string } | string | null | undefined
  const who =
    (typeof user === 'object' && user ? user.name || user.email : '') || str(doc.actor) || 'System'
  return {
    id: String(doc.id),
    action: str(doc.action),
    target: str(doc.target),
    docId: str(doc.docId),
    who,
    createdAt: str(doc.createdAt),
  }
}

async function loadCategories(
  payload: Payload,
  as: { user: DashboardUser; overrideAccess: false; disableErrors: true },
): Promise<CategoryCount[]> {
  const cats = await payload.find({
    collection: 'categories',
    sort: 'order',
    limit: 30,
    depth: 0,
    pagination: false,
    select: { name: true },
    ...as,
  })
  const counted = await Promise.all(
    cats.docs.map(async (c) => {
      const doc = c as Record<string, unknown>
      const { totalDocs } = await payload.count({
        collection: 'posts',
        where: {
          and: [{ primaryCategory: { equals: doc.id } }, { _status: { equals: 'published' } }],
        },
        ...as,
      })
      return { id: String(doc.id), name: str(doc.name) || '(unnamed)', posts: totalDocs }
    }),
  )
  return counted.sort((a, b) => b.posts - a.posts)
}

export async function loadDashboard(payload: Payload, user: DashboardUser): Promise<DashboardData> {
  const as = { user, overrideAccess: false, disableErrors: true } as const
  const ownDraftsOnly = !hasRole(user as never, 'admin', 'editor')
  const draftWhere: Where = ownDraftsOnly
    ? { and: [{ _status: { equals: 'draft' } }, { createdBy: { equals: user.id } }] }
    : { _status: { equals: 'draft' } }
  const publishedWhere: Where = { _status: { equals: 'published' } }
  const reviewWhere: Where = { 'flags.needsReview': { equals: true } }
  const newMessagesWhere: Where = { status: { equals: 'new' } }
  const rows = { depth: 0, pagination: false, select: ROW_SELECT, sort: '-updatedAt' } as const

  const [
    published,
    drafts,
    needsReview,
    pages,
    media,
    newMessages,
    draftList,
    publishedList,
    reviewList,
    messageList,
    activityList,
    categories,
  ] = await Promise.all([
    payload.count({ collection: 'posts', where: publishedWhere, ...as }),
    payload.count({ collection: 'posts', where: draftWhere, ...as }),
    payload.count({ collection: 'posts', where: reviewWhere, ...as }),
    payload.count({ collection: 'pages', ...as }),
    payload.count({ collection: 'media', ...as }),
    payload.count({ collection: 'contact-messages', where: newMessagesWhere, ...as }),
    payload.find({
      collection: 'posts',
      where: draftWhere,
      limit: LIST_LIMIT,
      draft: true,
      ...rows,
      ...as,
    }),
    payload.find({
      collection: 'posts',
      where: publishedWhere,
      limit: LIST_LIMIT,
      ...rows,
      sort: '-publishedAt',
      ...as,
    }),
    payload.find({ collection: 'posts', where: reviewWhere, limit: LIST_LIMIT, ...rows, ...as }),
    payload.find({
      collection: 'contact-messages',
      sort: '-createdAt',
      limit: 5,
      depth: 0,
      pagination: false,
      select: { name: true, subject: true, status: true, createdAt: true },
      ...as,
    }),
    payload.find({
      collection: 'audit-logs',
      sort: '-createdAt',
      limit: 8,
      depth: 1,
      pagination: false,
      ...as,
    }),
    loadCategories(payload, as),
  ])

  return {
    ownDraftsOnly,
    stats: {
      published: published.totalDocs,
      drafts: drafts.totalDocs,
      needsReview: needsReview.totalDocs,
      pages: pages.totalDocs,
      media: media.totalDocs,
      newMessages: newMessages.totalDocs,
    },
    drafts: draftList.docs.map((d) => toRow(d as Record<string, unknown>)),
    published: publishedList.docs.map((d) => toRow(d as Record<string, unknown>)),
    review: reviewList.docs.map((d) => toRow(d as Record<string, unknown>)),
    categories,
    messages: messageList.docs.map((d) => {
      const doc = d as Record<string, unknown>
      return {
        id: String(doc.id),
        name: str(doc.name) || 'Unknown sender',
        subject: str(doc.subject) || '(no subject)',
        createdAt: str(doc.createdAt),
        status: str(doc.status) || 'new',
      }
    }),
    activity: activityList.docs.map((d) => toActivity(d as unknown as Record<string, unknown>)),
  }
}
