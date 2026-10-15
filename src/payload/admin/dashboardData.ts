import 'server-only'
import type { Payload, Where } from 'payload'
import { aiSearchConfigured } from '@/features/ai-search/service'
import { whatsappLink } from '@/lib/whatsapp'
import { hasRole } from '@/payload/access'
import type { Homepage, SiteSetting } from '@/payload-types'
import {
  dailyCounts,
  latestDate,
  yearCounts,
  type DayCount,
  type YearCount,
} from './dashboardStats'

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

export type FormatKey = 'standard' | 'video' | 'ebook' | 'audio'
export type FormatCount = { key: FormatKey; label: string; count: number }

/** Switches editors ask about most: is the homepage fully shown, is chat / AI search on. */
export type SiteStatus = {
  sectionsShown: number
  sectionsHidden: number
  whatsappOn: boolean
  aiSearchOn: boolean
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
  /** Published posts per India calendar year, first year with posts → this year. */
  years: YearCount[]
  /** Published posts by format; always the four formats, in this order. */
  formats: FormatCount[]
  /** The newest `publishedAt` among published posts. */
  lastPublishedAt: string | null
  /** Audit-log entries per day for the last PULSE_DAYS days (empty when the role can't read them). */
  pulse: DayCount[]
  /** null when this role can read neither the homepage nor the site settings. */
  site: SiteStatus | null
}

export const PULSE_DAYS = 14
const LIST_LIMIT = 6
/** Upper bound for the year / format roll-up (one lightweight two-field read of published posts). */
const ROLLUP_LIMIT = 20_000
const FORMAT_LABEL: Record<FormatKey, string> = {
  standard: 'Articles',
  video: 'Videos',
  ebook: 'E-books',
  audio: 'Audios',
}
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

type As = { user: DashboardUser; overrideAccess: false; disableErrors: true }

const formatCounts = (byFormat: Record<FormatKey, number>): FormatCount[] =>
  (Object.keys(FORMAT_LABEL) as FormatKey[]).map((key) => ({
    key,
    label: FORMAT_LABEL[key],
    count: byFormat[key],
  }))

const emptyRollup = () => ({
  years: [] as YearCount[],
  lastPublishedAt: null as string | null,
  formats: formatCounts({ standard: 0, video: 0, ebook: 0, audio: 0 }),
})

/** One two-field read of the published posts feeds the by-year chart, the format mix and "last published". */
async function loadRollup(payload: Payload, as: As) {
  const res = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    select: { publishedAt: true, format: true },
    depth: 0,
    pagination: false,
    limit: ROLLUP_LIMIT,
    ...as,
  })
  const docs = res.docs as Array<{ publishedAt?: string | null; format?: string | null }>
  const dates = docs.map((d) => d.publishedAt)
  const byFormat: Record<FormatKey, number> = { standard: 0, video: 0, ebook: 0, audio: 0 }
  for (const d of docs) {
    // Posts saved before the format field existed count as articles.
    const key =
      d.format === 'video' || d.format === 'ebook' || d.format === 'audio' ? d.format : 'standard'
    byFormat[key] += 1
  }
  return {
    years: yearCounts(dates),
    lastPublishedAt: latestDate(dates),
    formats: formatCounts(byFormat),
  }
}

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

export async function loadDashboard(payload: Payload, user: DashboardUser): Promise<DashboardData> {
  const as = { user, overrideAccess: false, disableErrors: true } as const
  const ownDraftsOnly = !hasRole(user as never, 'admin', 'editor')
  const draftWhere: Where = ownDraftsOnly
    ? { and: [{ _status: { equals: 'draft' } }, { createdBy: { equals: user.id } }] }
    : { _status: { equals: 'draft' } }
  const publishedWhere: Where = { _status: { equals: 'published' } }
  const reviewWhere: Where = { 'flags.needsReview': { equals: true } }
  const newMessagesWhere: Where = { status: { equals: 'new' } }
  const newRequestsWhere: Where = { status: { equals: 'new' } }
  const rows = { depth: 0, pagination: false, select: ROW_SELECT, sort: '-updatedAt' } as const

  const [
    published,
    drafts,
    needsReview,
    pages,
    media,
    newMessages,
    newRequests,
    draftList,
    publishedList,
    reviewList,
    messageList,
    activityList,
    categories,
    rollup,
    pulse,
    site,
  ] = await Promise.all([
    payload.count({ collection: 'posts', where: publishedWhere, ...as }),
    payload.count({ collection: 'posts', where: draftWhere, ...as }),
    payload.count({ collection: 'posts', where: reviewWhere, ...as }),
    payload.count({ collection: 'pages', ...as }),
    payload.count({ collection: 'media', ...as }),
    payload.count({ collection: 'contact-messages', where: newMessagesWhere, ...as }),
    payload.count({ collection: 'postal-requests', where: newRequestsWhere, ...as }),
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
    // The charts are extras: if one cannot load, the rest of the dashboard still shows.
    loadRollup(payload, as).catch((err) => {
      payload.logger.warn({ err }, 'Dashboard roll-up could not load')
      return emptyRollup()
    }),
    loadPulse(payload, as).catch(() => dailyCounts([], PULSE_DAYS)),
    loadSite(payload, as),
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
      newRequests: newRequests.totalDocs,
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
    ...rollup,
    pulse,
    site,
  }
}
