import { timeAgo } from '@/lib/format'
import type { DashboardStats, QueueEdges } from '../dashboardData'

/**
 * The "Needs you today" work queue as plain data (no React, no Payload), so what shows, in what order,
 * and with which words is unit-tested. A row exists only while something is waiting, and only for a
 * role that may read what it points at.
 */
export type QueueIcon = 'review' | 'postal' | 'inbox' | 'draft'

export type QueueRow = {
  key: 'review' | 'postal' | 'messages' | 'drafts'
  title: string
  detail: string
  count: number
  action: string
  href: string
  icon: QueueIcon
  /** Colours the icon tile: amber for review, blue for the inbox, grey for drafts. */
  tone: 'warn' | 'info' | 'muted'
}

type CanRead = (slug: string) => boolean

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** "Oldest flagged 2 days ago": the phrase before `when`, then how long ago it was. */
const ago = (lead: string, value: string | null, now: number): string => {
  const when = timeAgo(value, now)
  return when ? `${lead} ${when}` : ''
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' · ')

export function buildQueue({
  stats,
  edges,
  admin,
  canRead,
  ownDraftsOnly,
  now = Date.now(),
}: {
  stats: Pick<DashboardStats, 'needsReview' | 'newRequests' | 'newMessages' | 'drafts'>
  edges: QueueEdges
  /** Admin route prefix, e.g. "/admin". */
  admin: string
  canRead: CanRead
  /** Authors are counted on their own drafts only. */
  ownDraftsOnly: boolean
  now?: number
}): QueueRow[] {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const rows: QueueRow[] = []

  if (canRead('posts') && stats.needsReview > 0) {
    rows.push({
      key: 'review',
      title: `${plural(stats.needsReview, 'post', 'posts')} flagged for review`,
      detail: ago('Oldest flagged', edges.reviewOldest, now) || 'Flagged by an editor',
      count: stats.needsReview,
      action: 'Review',
      href: `${col('posts')}?where[flags.needsReview][equals]=true`,
      icon: 'review',
      tone: 'warn',
    })
  }
  if (canRead('postal-requests') && stats.newRequests > 0) {
    rows.push({
      key: 'postal',
      title: plural(stats.newRequests, 'postal library request', 'postal library requests'),
      detail: join('Waiting to be handled', ago('newest', edges.requestNewest, now)),
      count: stats.newRequests,
      action: 'Open',
      href: `${col('postal-requests')}?where[status][equals]=new`,
      icon: 'postal',
      tone: 'info',
    })
  }
  if (canRead('contact-messages') && stats.newMessages > 0) {
    rows.push({
      key: 'messages',
      title: plural(stats.newMessages, 'new message', 'new messages'),
      detail: join('From the contact form', ago('newest', edges.messageNewest, now)),
      count: stats.newMessages,
      action: 'Open inbox',
      href: `${col('contact-messages')}?where[status][equals]=new`,
      icon: 'inbox',
      tone: 'info',
    })
  }
  if (canRead('posts') && stats.drafts > 0) {
    rows.push({
      key: 'drafts',
      title: `${plural(stats.drafts, 'draft', 'drafts')} in progress`,
      detail:
        ago('Oldest edited', edges.draftOldest, now) ||
        (ownDraftsOnly ? 'Your unfinished posts' : 'Not live yet'),
      count: stats.drafts,
      action: 'Continue',
      href: `${col('posts')}?where[_status][equals]=draft`,
      icon: 'draft',
      tone: 'muted',
    })
  }
  return rows
}

/** "4 things need you today", "1 thing needs you today", or the all-clear line. */
export function queueSummary(count: number): string {
  if (count <= 0) return 'Nothing needs you today'
  return count === 1 ? '1 thing needs you today' : `${count} things need you today`
}
