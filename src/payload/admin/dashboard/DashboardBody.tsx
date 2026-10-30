import Link from 'next/link'
import type { SanitizedPermissions } from 'payload'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FilePen,
  Flag,
  Inbox,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardData } from '../dashboardData'
import { TZ } from '../dashboardStats'
import { RecentPosts } from './RecentPosts'
import { ActivityRows, LatestList, Panel, StatusStrip, type StatusRow } from './parts'
import { buildQueue, queueSummary, type QueueIcon } from './queue'
import { FormatMix, Pulse, RankBars, TrendLine } from './charts'
import { StatCards } from './stats'

/**
 * The Dashboard (admin home): this month at a glance, the publishing trend and the latest posts,
 * what needs you, the top categories and bylines, recent edits and the activity trail.
 * Presentational (no data access), so it renders from DashboardView's real data or from mock data.
 * Every link and panel is filtered by the signed-in user's permissions.
 */
export type DashboardUser = {
  id: string | number
  name?: string | null
  email?: string
  role?: string | null
} & Record<string, unknown>

type BodyProps = {
  data: DashboardData
  /** Admin route prefix, e.g. "/admin". */
  admin: string
  permissions?: SanitizedPermissions
  user: DashboardUser
  now?: Date
}

const QUEUE_ICON: Record<QueueIcon, LucideIcon> = {
  review: Flag,
  postal: BookOpen,
  inbox: Inbox,
  draft: FilePen,
}

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', timeZone: TZ }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardBody({ data, admin, permissions, user, now = new Date() }: BodyProps) {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const can = permissions ?? {}
  const canRead = (slug: string) => Boolean(can.collections?.[slug]?.read)
  const posts = col('posts')
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(now)
  const name = user.name || user.email?.split('@')[0] || 'there'

  const queue = buildQueue({
    stats: data.stats,
    edges: data.queue,
    admin,
    canRead,
    ownDraftsOnly: data.ownDraftsOnly,
    now: now.getTime(),
  })

  const site = data.site
  const statusRows: StatusRow[] = [
    ...(site
      ? ([
          {
            label: 'Homepage',
            state: site.sectionsShown > 0 ? 'on' : 'off',
            detail:
              site.sectionsHidden > 0
                ? `${site.sectionsShown} sections shown, ${site.sectionsHidden} hidden`
                : `${site.sectionsShown} sections shown`,
            href: can.globals?.homepage?.update ? `${admin}/globals/homepage` : null,
          },
          {
            label: 'WhatsApp chat',
            state: site.whatsappOn ? 'on' : 'off',
            detail: site.whatsappOn
              ? 'The chat button is shown on the site'
              : 'Add a number in Site settings to show the button',
            href: can.globals?.['site-settings']?.update ? `${admin}/globals/site-settings` : null,
          },
          {
            label: 'AI search',
            state: site.aiSearchOn ? 'on' : 'off',
            detail: site.aiSearchOn
              ? 'Visitors can ask questions'
              : 'Switched off. Ask the site developer to turn it on.',
          },
        ] satisfies StatusRow[])
      : []),
    {
      label: 'Two-step login',
      state: data.twoStepOn ? 'on' : 'off',
      detail: data.twoStepOn ? 'Required for all staff' : 'Staff sign in with a password only',
      href: can.globals?.['security-settings']?.update
        ? `${admin}/globals/security-settings`
        : null,
    },
  ]

  const canSeeActivity = canRead('audit-logs')
  const canReadCategories = canRead('categories')
  const canReadAuthors = canRead('authors')

  return (
    <div className="im-dash im-page">
      <header className="im-page__head">
        <div>
          <p className="im-eyebrow">Last 30 days · {today}</p>
          <h1 className="im-page__title">
            {greeting(now)}, {name}
          </h1>
          <p className="im-page__lead">
            Publishing activity across the site · {queueSummary(queue.length)}
          </p>
        </div>
        <div className="im-page__actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="im-btn">
            <ExternalLink aria-hidden="true" />
            View website
          </a>
          {can.collections?.posts?.create ? (
            <Link href={`${posts}/create`} className="im-btn im-btn--primary">
              <Plus aria-hidden="true" />
              New post
            </Link>
          ) : null}
        </div>
      </header>

      <StatCards data={data} admin={admin} permissions={permissions} />

      {canRead('posts') ? (
        <div className="im-dash__grid im-dash__grid--wide">
          <Panel
            title="Posts published"
            sub="Per day, in the last 30 days."
            className="im-dash__panel--trend"
          >
            <TrendLine days={data.daily30} noun="post" />
          </Panel>
          <Panel
            title="Latest posts"
            sub="Most recently published."
            href={`${posts}?where[_status][equals]=published`}
            hrefLabel="View all"
            className="im-dash__panel--flush"
          >
            <LatestList rows={data.published} admin={admin} empty="Nothing published yet." />
          </Panel>
        </div>
      ) : null}

      <div className="im-dash__grid im-dash__grid--three">
        <Panel
          title="Needs your attention"
          className="im-dash__panel--flush"
          aside={
            queue.length ? (
              <span className="im-pill im-pill--warn">
                {queue.length} {queue.length === 1 ? 'item' : 'items'}
              </span>
            ) : null
          }
        >
          {queue.length ? (
            <ul className="im-queue">
              {queue.map((row) => {
                const Icon = QUEUE_ICON[row.icon]
                return (
                  <li key={row.key}>
                    <Link href={row.href} className="im-queue__row">
                      <span className={`im-queue__icon im-queue__icon--${row.tone}`}>
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="im-queue__text">
                        <span className="im-queue__title">{row.title}</span>
                        <span className="im-queue__detail">{row.detail}</span>
                      </span>
                      <span className="im-queue__action">
                        {row.action}
                        <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="im-dash__clear">
              <CheckCircle2 aria-hidden="true" />
              You are all caught up: nothing waiting for review, no new messages, no postal library
              requests.
            </p>
          )}
        </Panel>

        {canReadCategories ? (
          <Panel title="Top categories" sub="Most published posts." href={col('categories')}>
            <RankBars
              rows={data.categories.map((c) => ({
                id: c.id,
                name: c.name,
                count: c.posts,
                href: `${posts}?where[primaryCategory][equals]=${c.id}`,
              }))}
              more="category"
            />
          </Panel>
        ) : null}

        {canReadAuthors ? (
          <Panel
            title="Top authors"
            sub={
              data.authorsWindow === 'month'
                ? 'Most posts published in the last 30 days.'
                : 'Most posts published, all time.'
            }
            href={col('authors')}
          >
            <RankBars
              rows={data.topAuthors.map((a) => ({
                id: a.id,
                name: a.name,
                count: a.posts,
                href: `${posts}?where[author][equals]=${a.id}`,
              }))}
              more="author"
              avatars
            />
          </Panel>
        ) : null}
      </div>

      {canRead('posts') ? (
        <div className="im-dash__grid im-dash__grid--wide">
          <Panel
            title="Recent edits"
            className="im-dash__panel--flush im-dash__panel--posts"
            href={posts}
            hrefLabel="All content"
          >
            <RecentPosts
              admin={admin}
              lists={{
                all: data.recent,
                published: data.published,
                drafts: data.drafts,
                review: data.review,
              }}
              counts={{
                all: data.stats.all,
                published: data.stats.published,
                drafts: data.stats.drafts,
                review: data.stats.needsReview,
              }}
            />
          </Panel>

          <div className="im-dash__stack">
            <Panel title="Content mix" sub="Published posts by kind.">
              <FormatMix formats={data.formats} admin={admin} />
            </Panel>
            {canSeeActivity ? (
              <Panel title="Activity" href={col('audit-logs')} hrefLabel="Activity log">
                <Pulse days={data.pulse} noun="action" />
                <ActivityRows rows={data.activity} admin={admin} />
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      <Panel title="Site status" className="im-dash__panel--status">
        <StatusStrip rows={statusRows} />
      </Panel>
    </div>
  )
}
