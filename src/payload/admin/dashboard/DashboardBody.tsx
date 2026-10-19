import Link from 'next/link'
import type { SanitizedPermissions } from 'payload'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FilePen,
  FileText,
  Flag,
  ImagePlus,
  ImageUp,
  Inbox,
  LayoutPanelTop,
  LayoutTemplate,
  Megaphone,
  Menu,
  Newspaper,
  PanelBottom,
  Plus,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardData } from '../dashboardData'
import { QuickAdd } from './QuickAdd'
import { RecentPosts } from './RecentPosts'
import { ActivityRows, Panel, StatusStrip, type StatusRow } from './parts'
import { buildQueue, queueSummary, type QueueIcon } from './queue'
import { Pulse } from './charts'

/**
 * The home screen ("Today"): what needs you, a place to start something new, the state of the site,
 * and recent work. Totals and charts live on Reports. Presentational (no data access), so it can
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
  /** Payload's REST route (the quick-add form saves through it), e.g. "/api". */
  api?: string
  permissions?: SanitizedPermissions
  user: DashboardUser
  now?: Date
}

type Tile = { label: string; href: string; icon: LucideIcon; allowed: boolean }
type Chip = { label: string; hint: string; href: string; icon: LucideIcon; allowed: boolean }

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

export function DashboardBody({
  data,
  admin,
  api = '/api',
  permissions,
  user,
  now = new Date(),
}: BodyProps) {
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

  const tiles: Tile[] = [
    {
      label: 'Post',
      href: `${posts}/create`,
      icon: Newspaper,
      allowed: Boolean(can.collections?.posts?.create),
    },
    {
      label: 'Page',
      href: `${col('pages')}/create`,
      icon: FileText,
      allowed: Boolean(can.collections?.pages?.create),
    },
    {
      label: 'Insight',
      href: `${col('quotes')}/create`,
      icon: ImagePlus,
      allowed: Boolean(can.collections?.quotes?.create),
    },
    {
      label: 'Upload files',
      href: `${col('media')}/create`,
      icon: ImageUp,
      allowed: Boolean(can.collections?.media?.create),
    },
  ]
  const allowedTiles = tiles.filter((t) => t.allowed)

  const chips: Chip[] = [
    {
      label: 'Website manager',
      hint: 'Every page and section, with where to edit it',
      href: `${admin}/website`,
      icon: LayoutPanelTop,
      allowed: Boolean(can.globals?.homepage?.update || can.globals?.header?.update),
    },
    {
      label: 'Homepage',
      hint: 'Sections and featured posts',
      href: `${admin}/globals/homepage`,
      icon: LayoutTemplate,
      allowed: Boolean(can.globals?.homepage?.update),
    },
    {
      label: 'Header and menu',
      hint: 'Top navigation',
      href: `${admin}/globals/header`,
      icon: Menu,
      allowed: Boolean(can.globals?.header?.update),
    },
    {
      label: 'Footer',
      hint: 'Links and contact details',
      href: `${admin}/globals/footer`,
      icon: PanelBottom,
      allowed: Boolean(can.globals?.footer?.update),
    },
    {
      label: 'Site settings',
      hint: 'Name, social links, search defaults',
      href: `${admin}/globals/site-settings`,
      icon: Settings,
      allowed: Boolean(can.globals?.['site-settings']?.update),
    },
    {
      label: 'Ads banners',
      hint: 'Top and bottom banners, with their links',
      href: `${admin}/globals/ads-banners`,
      icon: Megaphone,
      allowed: Boolean(can.globals?.['ads-banners']?.update),
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
  const canQuickAdd = Boolean(can.collections?.audios?.create || can.collections?.videos?.create)
  const hasCreate = Boolean(allowedTiles.length || canQuickAdd)
  // The board has one column per block that this person can use, so no column is ever left empty.
  const boardColumns = 1 + Number(hasCreate) + Number(allowedChips.length > 0)

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
            View site
          </a>
          {can.collections?.posts?.create ? (
            <Link href={`${posts}/create`} className="im-dash__btn im-dash__btn--primary">
              <Plus aria-hidden="true" />
              New post
            </Link>
          ) : null}
        </div>
      </header>

      <div className={`im-board im-board--${boardColumns}`}>
        <div className="im-board__col">
          <Panel
            title="Needs you today"
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
          <Panel title="Site status" className="im-board__grow">
            <StatusStrip rows={statusRows} />
          </Panel>
        </div>

        {hasCreate ? (
          <div className="im-board__col">
            <Panel title="Create" className="im-dash__create im-board__grow">
              {allowedTiles.length ? (
                <ul className="im-tiles">
                  {allowedTiles.map(({ label, href, icon: Icon }) => (
                    <li key={href}>
                      <Link href={href} className="im-tiles__tile">
                        <Icon aria-hidden="true" />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canQuickAdd ? (
                <QuickAdd
                  api={api}
                  adminBase={admin}
                  audio={Boolean(can.collections?.audios?.create)}
                  video={Boolean(can.collections?.videos?.create)}
                />
              ) : null}
            </Panel>
          </div>
        ) : null}

        {allowedChips.length ? (
          <div className="im-board__col im-board__col--wide">
            <Panel title="Edit the site" className="im-board__grow">
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
          </div>
        ) : null}
      </div>

      <div className="im-dash__grid">
        <Panel
          title="Recent posts"
          className="im-dash__panel--flush"
          href={posts}
          hrefLabel="See all posts"
        >
          <RecentPosts
            admin={admin}
            recent={data.recent}
            drafts={data.drafts}
            published={data.published}
          />
        </Panel>

        {canSeeActivity ? (
          <Panel title="Activity" href={col('audit-logs')} hrefLabel="Activity log">
            <Pulse days={data.pulse} noun="action" />
            <ActivityRows rows={data.activity} admin={admin} />
          </Panel>
        ) : null}
      </div>

      <Link href={`${admin}/reports`} className="im-dash__reports">
        <TrendingUp aria-hidden="true" />
        <span>
          Totals, posts per year and the content mix now live in <strong>Reports</strong>, one click
          away.
        </span>
        <span className="im-dash__reports-go">
          Open Reports
          <ArrowRight aria-hidden="true" />
        </span>
      </Link>
    </div>
  )
}
