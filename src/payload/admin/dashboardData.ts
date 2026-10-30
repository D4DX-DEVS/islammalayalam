import 'server-only'
import type { Payload, Where } from 'payload'
import type { ContentFormat } from '@/cms/content-types'
import { aiSearchConfigured } from '@/features/ai-search/service'
import { whatsappLink } from '@/lib/whatsapp'
import { hasRole } from '@/payload/access'
import type { Homepage, SiteSetting } from '@/payload-types'
import { emptyRollup, loadRollup } from './dashboardRollup'
import { dailyCounts, type DayCount, type YearCount } from './dashboardStats'

/**
 * Data for the admin dashboard. Every query runs AS the signed-in user (`overrideAccess: false`)
 * so collection/field access and the TOTP wrapper apply exactly as they do in the REST API; a
 * session that may not read something gets zeros/empty lists (`disableErrors`), never a leak.
 */
export type DashboardUser = { id: string | number; role?: string | null } & Record<
  string,
  unknown
>

export type DashboardRow = {
  id: string
  title: string
  updatedAt: string
  postNumber: number | null
  status: 'draft' | 'published'
  /** Flagged by an editor for a second look. */
  needsReview: boolean
  /** Name of the post's main category, when it has one. */
  category: string | null
  /** Small picture (the featured image's thumb rendition), when it has one. */
  thumb: string | null
  /** Byline, when it has one. */
  author: string | null
  publishedAt: string | null
}

export type AuthorCount = { id: string; name: string; posts: number }

export type DashboardStats = {
  /** Every post this person can see (published and drafts). */
  all: number
  published: number
  drafts: number
  needsReview: number
  pages: number
  media: number
  newMessages: number
  newRequests: number
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

export type FormatKey = ContentFormat
export type FormatCount = { key: FormatKey; label: string; count: number }

/** Switches editors ask about most: is the homepage fully shown, is chat / AI search / two-step login on. */
export type SiteStatus = {
  sectionsShown: number
  sectionsHidden: number
  whatsappOn: boolean
  aiSearchOn: boolean
}

/**
 * When the oldest / newest item behind each work-queue row was last touched (ISO strings), so a row
 * can say "oldest flagged 2 days ago". null when there is nothing waiting.
 */
export type QueueEdges = {
  /** Oldest post flagged for review. */
  reviewOldest: string | null
  /** Newest postal library request nobody has handled. */
  requestNewest: string | null
  /** Newest message nobody has opened. */
  messageNewest: string | null
  /** The draft that has gone longest without an edit. */
  draftOldest: string | null
}

/** "today" is the task list alone; "reports" adds the totals and charts (the Dashboard shows both). */
export type DashboardScope = 'today' | 'reports'

export type DashboardData = {
  /** Authors only see (and are counted on) their own drafts. */
  ownDraftsOnly: boolean
  stats: DashboardStats
  queue: QueueEdges
  /** Latest edits across drafts and published posts, newest first. */
  recent: DashboardRow[]
  drafts: DashboardRow[]
  published: DashboardRow[]
  /** Flagged for review, latest edit first. */
  review: DashboardRow[]
  categories: CategoryCount[]
  messages: MessageRow[]
  activity: ActivityRow[]
  /** Published posts per India calendar year, first year with posts → this year. */
  years: YearCount[]
  /** Published posts by format; always the four formats, in this order. */
  formats: FormatCount[]
  /** The newest `publishedAt` among published posts. */
  lastPublishedAt: string | null
  /** Posts published in the last 30 days, and in the 30 days before that (the trend). */
  published30: number
  publishedPrev30: number
  /** Posts published per India calendar day, last 30 days. */
  daily30: DayCount[]
  /** Bylines with the most published posts in the last 30 days (all time while the month is empty). */
  topAuthors: AuthorCount[]
  authorsWindow: 'month' | 'all'
  /** Audit-log entries per day for the last PULSE_DAYS days (empty when the role can't read them). */
  pulse: DayCount[]
  /** null when this role can read neither the homepage nor the site settings. */
  site: SiteStatus | null
  /** Two-step login is required for staff (from the signed-in user's own `mfaRequired`). */
  twoStepOn: boolean
}

export const PULSE_DAYS = 14
const LIST_LIMIT = 6
const ROW_SELECT = {
  title: true,
  updatedAt: true,
  publishedAt: true,
  postNumber: true,
  _status: true,
  flags: { needsReview: true },
  primaryCategory: true,
  featuredImage: true,
  author: true,
} as const
/** Rows show names and a small picture only; depth 1 then populates just those fields. */
const ROW_POPULATE = {
  categories: { name: true },
  authors: { name: true },
  media: { url: true, sizes: true },
} as const

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

type Named = { name?: unknown } | string | null | undefined
const nameOf = (value: Named): string | null =>
  typeof value === 'object' && value ? str(value.name) || null : null

function toRow(doc: Record<string, unknown>): DashboardRow {
  const flags = doc.flags as { needsReview?: unknown } | null | undefined
  const image = doc.featuredImage as
    | { url?: unknown; sizes?: { thumb?: { url?: unknown } } }
    | string
    | null
    | undefined
  const thumb =
    typeof image === 'object' && image ? str(image.sizes?.thumb?.url) || str(image.url) : ''
  return {
    id: String(doc.id),
    title: str(doc.title) || '(untitled)',
    updatedAt: str(doc.updatedAt),
    postNumber: typeof doc.postNumber === 'number' ? doc.postNumber : null,
    status: doc._status === 'published' ? 'published' : 'draft',
    needsReview: flags?.needsReview === true,
    category: nameOf(doc.primaryCategory as Named),
    thumb: thumb || null,
    author: nameOf(doc.author as Named),
    publishedAt: str(doc.publishedAt) || null,
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

/** Every query runs as the signed-in user, and a refused one yields zeros instead of an error. */
export type As = { user: DashboardUser; overrideAccess: false; disableErrors: true }

async function loadPulse(payload: Payload, as: As): Promise<DayCount[]> {
  const now = new Date()
  const since = new Date(now.getTime() - PULSE_DAYS * 86_400_000).toISOString()
  const res = await payload.find({
    collection: 'audit-logs',
    where: { createdAt: { greater_than_equal: since } },
    select: { createdAt: true },
    depth: 0,
    pagination: false,
    limit: 5000,
    ...as,
  })
  return dailyCounts(
    res.docs.map((d) => (d as { createdAt?: string }).createdAt),
    PULSE_DAYS,
    now,
  )
}

async function loadSite(payload: Payload, as: As): Promise<SiteStatus | null> {
  const [homepage, settings] = await Promise.all([
    payload
      .findGlobal({ slug: 'homepage', depth: 0, ...as })
      .catch(() => null) as Promise<Homepage | null>,
    payload
      .findGlobal({ slug: 'site-settings', depth: 0, ...as })
      .catch(() => null) as Promise<SiteSetting | null>,
  ])
  if (!homepage && !settings) return null
  const layout = homepage?.layout ?? []
  const hidden = layout.filter((block) => Boolean(block.hidden)).length
  return {
    sectionsShown: layout.length - hidden,
    sectionsHidden: hidden,
    whatsappOn: Boolean(
      whatsappLink({
        number: settings?.contact?.whatsappNumber,
        message: settings?.contact?.whatsappMessage,
        url: settings?.social?.whatsapp,
      }),
    ),
    aiSearchOn: aiSearchConfigured(),
  }
}

/** `updatedAt` / `createdAt` of the first document of a one-item query, or null when there is none. */
async function edge(
  payload: Payload,
  as: As,
  query: {
    collection: 'posts' | 'postal-requests' | 'contact-messages'
    where: Where
    sort: string
    field: 'updatedAt' | 'createdAt'
    draft?: boolean
  },
): Promise<string | null> {
  try {
    const res = await payload.find({
      collection: query.collection,
      where: query.where,
      sort: query.sort,
      limit: 1,
      depth: 0,
      pagination: false,
      select: { [query.field]: true },
      ...(query.draft ? { draft: true } : {}),
      ...as,
    })
    const doc = res.docs[0] as unknown as Record<string, unknown> | undefined
    return doc ? str(doc[query.field]) || null : null
  } catch {
    return null
  }
}

export async function loadDashboard(
  payload: Payload,
  user: DashboardUser,
  scope: DashboardScope = 'today',
): Promise<DashboardData> {
  const reports = scope === 'reports'
  const none = Promise.resolve({ totalDocs: 0 })
  const as = { user, overrideAccess: false, disableErrors: true } as const
  const ownDraftsOnly = !hasRole(user as never, 'admin', 'editor')
  const draftWhere: Where = ownDraftsOnly
    ? { and: [{ _status: { equals: 'draft' } }, { createdBy: { equals: user.id } }] }
    : { _status: { equals: 'draft' } }
  const publishedWhere: Where = { _status: { equals: 'published' } }
  const reviewWhere: Where = { 'flags.needsReview': { equals: true } }
  const newMessagesWhere: Where = { status: { equals: 'new' } }
  const newRequestsWhere: Where = { status: { equals: 'new' } }
  const recentWhere: Where = ownDraftsOnly
    ? { or: [publishedWhere, { createdBy: { equals: user.id } }] }
    : { _status: { exists: true } }
  const rows = {
    depth: 1,
    populate: ROW_POPULATE,
    pagination: false,
    select: ROW_SELECT,
    sort: '-updatedAt',
  } as const

  const [
    published,
    drafts,
    needsReview,
    pages,
    media,
    newMessages,
    newRequests,
    allPosts,
    recentList,
    draftList,
    publishedList,
    reviewList,
    messageList,
    activityList,
    categories,
    rollup,
    pulse,
    site,
    reviewOldest,
    requestNewest,
    messageNewest,
    draftOldest,
  ] = await Promise.all([
    reports ? payload.count({ collection: 'posts', where: publishedWhere, ...as }) : none,
    payload.count({ collection: 'posts', where: draftWhere, ...as }),
    payload.count({ collection: 'posts', where: reviewWhere, ...as }),
    reports ? payload.count({ collection: 'pages', ...as }) : none,
    reports ? payload.count({ collection: 'media', ...as }) : none,
    payload.count({ collection: 'contact-messages', where: newMessagesWhere, ...as }),
    payload.count({ collection: 'postal-requests', where: newRequestsWhere, ...as }),
    payload.count({ collection: 'posts', where: recentWhere, ...as }),
    payload.find({
      collection: 'posts',
      where: recentWhere,
      limit: LIST_LIMIT,
      draft: true,
      ...rows,
      ...as,
    }),
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
    payload.find({
      collection: 'posts',
      where: reviewWhere,
      limit: LIST_LIMIT,
      draft: true,
      ...rows,
      ...as,
    }),
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
      limit: LIST_LIMIT,
      depth: 1,
      pagination: false,
      ...as,
    }),
    reports ? loadCategories(payload, as) : Promise.resolve([] as CategoryCount[]),
    // The charts are extras: if one cannot load, the rest of the page still shows.
    reports
      ? loadRollup(payload, as).catch((err) => {
          payload.logger.warn({ err }, 'Dashboard roll-up could not load')
          return emptyRollup()
        })
      : Promise.resolve(emptyRollup()),
    loadPulse(payload, as).catch(() => dailyCounts([], PULSE_DAYS)),
    loadSite(payload, as),
    edge(payload, as, {
      collection: 'posts',
      where: reviewWhere,
      sort: 'updatedAt',
      field: 'updatedAt',
    }),
    edge(payload, as, {
      collection: 'postal-requests',
      where: newRequestsWhere,
      sort: '-createdAt',
      field: 'createdAt',
    }),
    edge(payload, as, {
      collection: 'contact-messages',
      where: newMessagesWhere,
      sort: '-createdAt',
      field: 'createdAt',
    }),
    edge(payload, as, {
      collection: 'posts',
      where: draftWhere,
      sort: 'updatedAt',
      field: 'updatedAt',
      draft: true,
    }),
  ])

  return {
    ownDraftsOnly,
    stats: {
      all: allPosts.totalDocs,
      published: published.totalDocs,
      drafts: drafts.totalDocs,
      needsReview: needsReview.totalDocs,
      pages: pages.totalDocs,
      media: media.totalDocs,
      newMessages: newMessages.totalDocs,
      newRequests: newRequests.totalDocs,
    },
    queue: { reviewOldest, requestNewest, messageNewest, draftOldest },
    recent: recentList.docs.map((d) => toRow(d as Record<string, unknown>)),
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
    ...rollup,
    pulse,
    site,
    twoStepOn: user.mfaRequired !== false,
  }
}
