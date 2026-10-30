import Link from 'next/link'
import type { SanitizedPermissions } from 'payload'
import {
  ArrowDownRight,
  ArrowUpRight,
  FilePen,
  Flag,
  Inbox,
  Newspaper,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardData } from '../dashboardData'
import { bucketSums, compact, full } from '../dashboardStats'
import { Sparkline } from './charts'

/**
 * The headline figures at the top of the Dashboard: the month's publishing (with its trend and a
 * small line), the drafts, the posts waiting for review and the inbox. Presentational; every card
 * is filtered by the signed-in user's permissions.
 */
type Props = {
  data: DashboardData
  /** Admin route prefix, e.g. "/admin". */
  admin: string
  permissions?: SanitizedPermissions
}

type Trend = { direction: 'up' | 'down' | 'flat' | 'new'; label: string }

type Card = {
  key: string
  label: string
  value: number
  hint: string
  href: string
  icon: LucideIcon
  /** Colours the icon tile only; the words carry the meaning. */
  tone: 'blue' | 'violet' | 'amber' | 'green'
  trend?: Trend
  spark?: number[]
}

/** "+17% vs the previous 30 days", or the plain facts when there is nothing to compare with. */
export function trendOf(current: number, previous: number): Trend {
  if (previous === 0) return current > 0 ? { direction: 'new', label: 'none the month before' } : { direction: 'flat', label: 'same as the month before' }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { direction: 'flat', label: 'same as the month before' }
  return {
    direction: pct > 0 ? 'up' : 'down',
    label: `${pct > 0 ? '+' : ''}${pct}% vs the month before`,
  }
}

export function StatCards({ data, admin, permissions }: Props) {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const can = permissions?.collections ?? {}
  const stats = data.stats
  const inbox = stats.newMessages + stats.newRequests

  const cards: Card[] = [
    ...(can.posts?.read
      ? ([
          {
            key: 'published',
            label: 'Published',
            value: data.published30,
            hint: 'in the last 30 days',
            href: `${col('posts')}?where[_status][equals]=published`,
            icon: Newspaper,
            tone: 'blue',
            trend: trendOf(data.published30, data.publishedPrev30),
            // Three-day sums: a 30-point daily line is noise at sparkline size.
            spark: bucketSums(
              data.daily30.map((d) => d.count),
              10,
            ),
          },
          {
            key: 'drafts',
            label: 'Drafts',
            value: stats.drafts,
            hint: data.ownDraftsOnly ? 'your unfinished posts' : 'not yet published',
            href: `${col('posts')}?where[_status][equals]=draft`,
            icon: FilePen,
            tone: 'violet',
          },
          {
            key: 'review',
            label: 'Pending review',
            value: stats.needsReview,
            hint: stats.needsReview ? 'waiting for an editor' : 'nothing waiting',
            href: `${col('posts')}?where[flags.needsReview][equals]=true`,
            icon: Flag,
            tone: 'amber',
          },
        ] satisfies Card[])
      : []),
    ...(can['contact-messages']?.read || can['postal-requests']?.read
      ? ([
          {
            key: 'inbox',
            label: 'Inbox',
            value: inbox,
            hint:
              inbox === 0
                ? 'nothing new'
                : `${full(stats.newMessages)} ${stats.newMessages === 1 ? 'message' : 'messages'} · ${full(stats.newRequests)} ${stats.newRequests === 1 ? 'request' : 'requests'}`,
            href: `${col('contact-messages')}?where[status][equals]=new`,
            icon: Inbox,
            tone: 'green',
          },
        ] satisfies Card[])
      : []),
  ]
  if (!cards.length) return null

  return (
    <ul className="im-stats" aria-label="This month at a glance">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <li key={card.key}>
            <Link href={card.href} className="im-stat" data-tone={card.tone}>
              <span className="im-stat__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="im-stat__body">
                <span className="im-stat__label">{card.label}</span>
                <span className="im-stat__row">
                  <span className="im-stat__value" title={full(card.value)}>
                    {compact(card.value)}
                  </span>
                  {card.spark ? (
                    <span className="im-stat__spark">
                      <Sparkline values={card.spark} />
                    </span>
                  ) : null}
                </span>
                {card.trend ? (
                  <span className={`im-stat__trend im-stat__trend--${card.trend.direction}`}>
                    {card.trend.direction === 'up' ? (
                      <ArrowUpRight aria-hidden="true" />
                    ) : card.trend.direction === 'down' ? (
                      <ArrowDownRight aria-hidden="true" />
                    ) : null}
                    {card.trend.label}
                  </span>
                ) : null}
                <span className="im-stat__hint">{card.hint}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
