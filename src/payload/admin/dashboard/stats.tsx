import type { SanitizedPermissions } from 'payload'
import {
  BarChart3,
  FileText,
  FolderTree,
  Images,
  Newspaper,
  PieChart,
  type LucideIcon,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { DashboardData } from '../dashboardData'
import { CategoryBars, ColumnChart, FormatMix } from './charts'
import { Panel, StatTile } from './parts'

/**
 * The Dashboard's totals and charts. Presentational, like DashboardBody; every tile and panel is filtered by the signed-in user's
 * permissions.
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
  /** Colours the icon tile only; the words carry the meaning. */
  tone: 'blue' | 'violet' | 'green'
}

/**
 * Site totals only. Drafts, review flags, messages and postal requests are counted in "Needs your
 * attention" and the Recent posts tabs, so they are not repeated here.
 */
export function ReportStats({ data, admin }: Props) {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const stats = data.stats

  const tiles: Tile[] = [
    {
      label: 'Published posts',
      value: stats.published,
      icon: Newspaper,
      href: col('posts'),
      hint: data.lastPublishedAt
        ? `Last published ${timeAgo(data.lastPublishedAt)}`
        : 'Nothing published yet',
      tone: 'blue',
    },
    {
      label: 'Pages',
      value: stats.pages,
      icon: FileText,
      href: col('pages'),
      hint: 'About, contact and other fixed pages',
      tone: 'violet',
    },
    {
      label: 'Files and images',
      value: stats.media,
      icon: Images,
      href: col('media'),
      hint: 'Images and PDFs',
      tone: 'green',
    },
  ]

  return (
    <ul className="im-dash__stats" aria-label="Content totals">
      {tiles.map((tile) => (
        <li key={tile.label} data-tone={tile.tone}>
          <StatTile
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            href={tile.href}
            icon={tile.icon}
          />
        </li>
      ))}
    </ul>
  )
}

export function ReportCharts({ data, admin, permissions }: Props) {
  const col = (slug: string) => `${admin}/collections/${slug}`
  const posts = col('posts')
  const canReadCategories = Boolean(permissions?.collections?.categories?.read)

  return (
    <>
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
        <Panel
          title="Content mix"
          icon={PieChart}
          href={posts}
          hrefLabel="All posts"
          className="im-dash__panel--mix"
        >
          <p className="im-dash__sub">Published posts by format.</p>
          <FormatMix formats={data.formats} admin={admin} />
        </Panel>
      </div>

      {canReadCategories ? (
        <Panel title="Top categories" icon={FolderTree} href={col('categories')}>
          <CategoryBars rows={data.categories} admin={admin} />
        </Panel>
      ) : null}
    </>
  )
}
