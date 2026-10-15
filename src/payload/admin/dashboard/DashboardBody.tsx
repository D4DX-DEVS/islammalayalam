import Link from 'next/link'
import type { SanitizedPermissions } from 'payload'
import {
  Activity,
  BarChart3,
  BookOpen,
  ExternalLink,
  FilePen,
  FilePlus2,
  FileText,
  Flag,
  FolderTree,
  ImageUp,
  Images,
  Inbox,
  LayoutPanelTop,
  LayoutTemplate,
  Menu,
  Newspaper,
  PanelBottom,
  PieChart,
  Plus,
  Send,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { DashboardData } from '../dashboardData'
import { CategoryBars, ColumnChart, FormatMix, Pulse } from './charts'
import {
  ActivityRows,
  MessageRows,
  Panel,
  PostRows,
  StatTile,
  StatusRows,
  type StatusRow,
} from './parts'

/**
 * The dashboard's layout: totals, charts, recent work, site status and the audit trail. Presentational
 * (no data access), so it can render from DashboardView's real data or from mock data. Every link and
 * panel is filtered by the signed-in user's permissions.
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

type Shortcut = { label: string; hint: string; href: string; icon: LucideIcon; allowed: boolean }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const TZ = 'Asia/Kolkata'

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
  const draftsHref = `${posts}?where[_status][equals]=draft`
  const reviewHref = `${posts}?where[flags.needsReview][equals]=true`
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(now)
  const name = user.name || user.email?.split('@')[0] || 'there'

  const stats = data.stats
  const tiles = [
    {
      label: 'Published posts',
      value: stats.published,
      icon: Newspaper,
      href: posts,
      hint: data.lastPublishedAt
        ? `Last published ${timeAgo(data.lastPublishedAt)}`
        : 'Nothing published yet',
    },
    {
      label: data.ownDraftsOnly ? 'Your drafts' : 'Drafts',
      value: stats.drafts,
      icon: FilePen,
      href: draftsHref,
      hint: stats.drafts > 0 ? 'Not live yet' : 'Everything is published',
    },
    {
      label: 'Needs review',
      value: stats.needsReview,
      icon: Flag,
      href: reviewHref,
      hint: stats.needsReview > 0 ? 'Flagged by editors' : 'Nothing flagged',
      flag: stats.needsReview > 0 ? ({ tone: 'warn', label: 'Action needed' } as const) : null,
    },
    {
      label: 'Pages',
      value: stats.pages,
      icon: FileText,
      href: col('pages'),
      hint: 'Static and KB pages',
    },
    {
      label: 'Media files',
      value: stats.media,
      icon: Images,
      href: col('media'),
      hint: 'Images and PDF',
    },
    {
      label: 'New messages',
      value: stats.newMessages,
      icon: Inbox,
      href: `${col('contact-messages')}?where[status][equals]=new`,
      hint: stats.newMessages > 0 ? 'Waiting in the inbox' : 'Inbox is clear',
      flag: stats.newMessages > 0 ? ({ tone: 'info', label: 'Unread' } as const) : null,
      hidden: !canRead('contact-messages'),
    },
    {
      label: 'Postal requests',
      value: stats.newRequests,
      icon: BookOpen,
      href: `${col('postal-requests')}?where[status][equals]=new`,
      hint: stats.newRequests > 0 ? 'Waiting to be handled' : 'No new requests',
      flag: stats.newRequests > 0 ? ({ tone: 'info', label: 'New' } as const) : null,
      hidden: !canRead('postal-requests'),
    },
  ].filter((tile) => !tile.hidden)

  const site = data.site
  const siteRows: StatusRow[] = site
    ? [
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
          detail: site.whatsappOn ? 'Button shown on the site' : 'Add a number in Site settings',
          href: can.globals?.['site-settings']?.update ? `${admin}/globals/site-settings` : null,
        },
        {
          label: 'AI search',
          state: site.aiSearchOn ? 'on' : 'off',
          detail: site.aiSearchOn ? 'Visitors can ask questions' : 'Needs a server API key',
        },
      ]
    : []

  const shortcuts: Shortcut[] = [
    {
      label: 'New page',
      hint: 'Static page or KB section',
      href: `${col('pages')}/create`,
      icon: FileText,
      allowed: Boolean(can.collections?.pages?.create),
    },
    {
      label: 'Upload media',
      hint: 'Images and PDF',
      href: `${col('media')}/create`,
      icon: ImageUp,
      allowed: Boolean(can.collections?.media?.create),
    },
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
      label: 'Header & menu',
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
      hint: 'Name, social, SEO defaults',
      href: `${admin}/globals/site-settings`,
      icon: Settings,
      allowed: Boolean(can.globals?.['site-settings']?.update),
    },
  ]
  const allowedShortcuts = shortcuts.filter((s) => s.allowed)

  return (
    <div className="im-dash im-dash--view">
      <header className="im-dash__hero">
        <div>
          <p className="im-dash__eyebrow">
            {today} · {ROLE_LABEL[user.role ?? ''] ?? 'Staff'}
          </p>
          <h1 className="im-dash__title">
            {greeting(now)}, {name}
          </h1>
          <p className="im-dash__lead">Here is what is happening on Islam Malayalam.</p>
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

      <ul className="im-dash__stats" aria-label="Content totals">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <StatTile
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
              href={tile.href}
              icon={tile.icon}
              flag={'flag' in tile ? tile.flag : null}
            />
          </li>
        ))}
      </ul>

      {allowedShortcuts.length ? (
        <nav className="im-dash__quick" aria-label="Quick actions">
          <span className="im-dash__quick-title">
            <FilePlus2 aria-hidden="true" />
            Quick actions
          </span>
          <ul>
            {allowedShortcuts.map(({ label, hint, href, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="im-dash__chip" title={hint}>
                  <Icon aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="im-dash__grid im-dash__grid--charts">
        <Panel title="Published posts by year" icon={BarChart3} href={posts} hrefLabel="All posts">
          <p className="im-dash__sub">
            {data.years.length
              ? 'How many posts went live each year.'
              : 'Charts appear once posts are published.'}
          </p>
          <ColumnChart
            columns={data.years.map((y) => ({
              key: String(y.year),
              label: String(y.year),
              short: `’${String(y.year).slice(2)}`,
              value: y.count,
            }))}
            noun="post"
            heads={['Year', 'Published posts']}
          />
        </Panel>
        <Panel title="Content mix" icon={PieChart} href={posts} hrefLabel="All posts">
          <p className="im-dash__sub">Published posts by format.</p>
          <FormatMix formats={data.formats} admin={admin} />
        </Panel>
      </div>

      <div className="im-dash__grid">
        <div className="im-dash__col">
          <Panel
            title={data.ownDraftsOnly ? 'Your recent drafts' : 'Recent drafts'}
            icon={FilePen}
            href={draftsHref}
          >
            <PostRows
              rows={data.drafts}
              admin={admin}
              empty="No drafts. Everything is published."
            />
          </Panel>
          <Panel title="Recently published" icon={Send} href={posts}>
            <PostRows rows={data.published} admin={admin} empty="Nothing published yet." />
          </Panel>
          {data.stats.needsReview > 0 ? (
            <Panel title="Needs review" icon={Flag} href={reviewHref}>
              <PostRows rows={data.review} admin={admin} empty="Nothing is waiting for review." />
            </Panel>
          ) : null}
          {canRead('audit-logs') ? (
            <Panel title="Recent activity" icon={Activity} href={col('audit-logs')}>
              <Pulse days={data.pulse} noun="action" />
              <ActivityRows rows={data.activity} admin={admin} />
            </Panel>
          ) : null}
        </div>

        <div className="im-dash__col">
          {siteRows.length ? (
            <Panel title="Site status" icon={SlidersHorizontal}>
              <StatusRows rows={siteRows} />
            </Panel>
          ) : null}
          {canRead('categories') ? (
            <Panel title="Top categories" icon={FolderTree} href={col('categories')}>
              <CategoryBars rows={data.categories} admin={admin} />
            </Panel>
          ) : null}
          {canRead('contact-messages') ? (
            <Panel title="Inbox" icon={Inbox} href={col('contact-messages')}>
              <MessageRows rows={data.messages} admin={admin} />
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
