import Link from 'next/link'
import type { SanitizedPermissions } from 'payload'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FilePen,
  Flag,
  FolderTree,
  Globe,
  Inbox,
  Plus,
  Quote,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardData } from '../dashboardData'
import { RecentPosts } from './RecentPosts'
import { ActivityRows, Panel, StatusStrip, type StatusRow } from './parts'
import { buildQueue, queueSummary, type QueueIcon } from './queue'
import { Pulse } from './charts'
import { ReportCharts, ReportStats } from './stats'

/**
 * The Dashboard (admin home): site totals, what needs you, the state of the site, recent work and
 * the charts. Presentational (no data access), so it can
 * render from DashboardView's real data or from mock data. Every link and panel is filtered by the
 * signed-in user's permissions.
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

type Chip = {
  label: string
  hint: string
  href: string
  icon: LucideIcon
  allowed: boolean
}

const TZ = 'Asia/Kolkata'

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

  // Quick actions, each in its own colour. New post and the media library are already one click away
  // (the header button and the "Files and images" total), so they are not repeated here.
  const chips: Chip[] = [
    {
      label: 'Manage categories',
      hint: 'Order, icons and visibility of topics',
      href: col('categories'),
      icon: FolderTree,
      allowed: Boolean(can.collections?.categories?.update),
    },
    {
      label: 'Insights',
      hint: 'Posters and thoughts for the homepage slider',
      href: col('quotes'),
      icon: Quote,
      allowed: Boolean(can.collections?.quotes?.update),
    },
    {
      label: 'Site',
      hint: 'Homepage, menus, banners and settings',
      href: `${admin}/website`,
      icon: Globe,
      allowed: Boolean(can.globals?.homepage?.update || can.globals?.header?.update),
    },
  ]
  const allowedChips = chips.filter((c) => c.allowed)

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

  return (
    <div className="im-dash im-dash--view">
      <header className="im-dash__hero">
        <div>
          <h1 className="im-dash__title">
            {greeting(now)}, {name}
          </h1>
          <p className="im-dash__lead">
            {today} · {queueSummary(queue.length)}
          </p>
        </div>
        <div className="im-dash__hero-actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="im-dash__btn">
            <ExternalLink aria-hidden="true" />
            View website
          </a>
          {can.collections?.posts?.create ? (
            <Link href={`${posts}/create`} className="im-dash__btn im-dash__btn--primary">
              <Plus aria-hidden="true" />
              New post
            </Link>
          ) : null}
        </div>
      </header>

      <ReportStats data={data} admin={admin} permissions={permissions} />

      <div className="im-board">
        <Panel
          title="Needs your attention"
          className="im-dash__panel--flush im-dash__panel--queue"
          aside={
            queue.length ? (
              <span className="im-dash__count">
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
                      <span className="im-queue__count" aria-hidden="true">
                        {row.count.toLocaleString('en-IN')}
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
              You are all caught up. Nothing is waiting for review, no new messages and no postal
              library requests.
            </p>
          )}
        </Panel>

        {allowedChips.length ? (
          <Panel title="Quick actions">
            <ul className="im-links">
              {allowedChips.map(({ label, hint, href, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="im-links__row">
                    <span className="im-links__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="im-links__text">
                      <span className="im-links__label">{label}</span>
                      <span className="im-links__hint">{hint}</span>
                    </span>
                    <ChevronRight className="im-links__go" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      <Panel title="Site status" className="im-dash__panel--status">
        <StatusStrip rows={statusRows} />
      </Panel>

      <ReportCharts data={data} admin={admin} permissions={permissions} />

      <div className="im-dash__grid">
        <Panel
          title="Recent posts"
          className="im-dash__panel--flush im-dash__panel--posts"
          href={posts}
          hrefLabel="View all posts"
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

        {canSeeActivity ? (
          <Panel title="Activity" href={col('audit-logs')} hrefLabel="Activity log">
            <Pulse days={data.pulse} noun="action" />
            <ActivityRows rows={data.activity} admin={admin} />
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
