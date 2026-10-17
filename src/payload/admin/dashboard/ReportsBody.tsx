import type { SanitizedPermissions } from 'payload'
import {
  BarChart3,
  BookOpen,
  FilePen,
  FileText,
  Flag,
  FolderTree,
  Images,
  Inbox,
  Newspaper,
  PieChart,
  type LucideIcon,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { DashboardData } from '../dashboardData'
import { CategoryBars, ColumnChart, FormatMix } from './charts'
import { Panel, StatTile } from './parts'

/**
 * Reports: the totals and charts that used to crowd the home screen. Presentational, like
 * DashboardBody; every tile and panel is filtered by the signed-in user's permissions.
 */
type Props = {
  data: DashboardData
  /** Admin route prefix, e.g. "/admin". */
  admin: string
  permissions?: SanitizedPermissions
}

type Tile = {
  label: string
  value: number
  icon: LucideIcon
  href: string
  hint: string
  flag?: { tone: 'warn' | 'info'; label: string } | null
  hidden?: boolean
}

export function ReportsBody({ data, admin, permissions }: Props) {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const can = permissions ?? {}
  const canRead = (slug: string) => Boolean(can.collections?.[slug]?.read)
  const posts = col('posts')
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
      href: `${posts}?where[_status][equals]=draft`,
      hint: stats.drafts > 0 ? 'Not live yet' : 'Everything is published',
    },
    {
      label: 'Needs review',
      value: stats.needsReview,
      icon: Flag,
      href: `${posts}?where[flags.needsReview][equals]=true`,
      hint: stats.needsReview > 0 ? 'Flagged by editors' : 'Nothing flagged',
      flag: stats.needsReview > 0 ? ({ tone: 'warn', label: 'Action needed' } as const) : null,
    },
    {
      label: 'Pages',
      value: stats.pages,
      icon: FileText,
      href: col('pages'),
      hint: 'About, contact and other fixed pages',
    },
    {
      label: 'Files and images',
      value: stats.media,
      icon: Images,
      href: col('media'),
      hint: 'Images and PDFs',
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
      label: 'Postal library requests',
      value: stats.newRequests,
      icon: BookOpen,
      href: `${col('postal-requests')}?where[status][equals]=new`,
      hint: stats.newRequests > 0 ? 'Waiting to be handled' : 'No new requests',
      flag: stats.newRequests > 0 ? ({ tone: 'info', label: 'New' } as const) : null,
      hidden: !canRead('postal-requests'),
    },
  ].filter((tile) => !tile.hidden) satisfies Tile[]

  return (
    <div className="im-dash im-dash--view">
      <header className="im-dash__hero">
        <div>
          <h1 className="im-dash__title">Reports</h1>
          <p className="im-dash__lead">Totals and trends across the site.</p>
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

      <div className="im-dash__grid">
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

      {canRead('categories') ? (
        <Panel title="Top categories" icon={FolderTree} href={col('categories')}>
          <CategoryBars rows={data.categories} admin={admin} />
        </Panel>
      ) : null}
    </div>
  )
}
