import Link from 'next/link'
import type { Payload, SanitizedPermissions } from 'payload'
import {
  ExternalLink,
  FilePen,
  FilePlus2,
  FileText,
  Flag,
  ImageUp,
  Images,
  LayoutTemplate,
  Menu,
  Newspaper,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { loadDashboard, type DashboardData, type DashboardRow } from './dashboardData'

/**
 * Editorial overview above Payload's collection cards (config: admin.components.beforeDashboard).
 * Quick actions are filtered by the signed-in user's permissions; lists/counts are loaded as that
 * user (see dashboardData.ts). Styles: app/(payload)/custom.scss (`im-dash*`).
 */
type Props = {
  payload: Payload
  permissions?: SanitizedPermissions
  user?:
    | ({ id: string | number; name?: string | null; email?: string; role?: string | null } & Record<
        string,
        unknown
      >)
    | null
}

type Action = { label: string; href: string; icon: LucideIcon; allowed: boolean }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }

function RowList({ rows, admin, empty }: { rows: DashboardRow[]; admin: string; empty: string }) {
  if (!rows.length) return <p className="im-dash__empty">{empty}</p>
  return (
    <ul className="im-dash__rows">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={`${admin}/collections/posts/${row.id}`} className="im-dash__row">
            <span className="im-dash__row-title">{row.title}</span>
            <span className="im-dash__row-meta">
              <span className={`im-dash__badge im-dash__badge--${row.status}`}>
                {row.status === 'draft' ? 'Draft' : 'Published'}
              </span>
              {row.postNumber ? <span>#{row.postNumber}</span> : null}
              {row.updatedAt ? <span>Edited {timeAgo(row.updatedAt)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Panel({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string
  icon: LucideIcon
  href: string
  children: React.ReactNode
}) {
  return (
    <section className="im-dash__panel">
      <header className="im-dash__panel-head">
        <h3>
          <Icon aria-hidden="true" />
          {title}
        </h3>
        <Link href={href}>View all</Link>
      </header>
      {children}
    </section>
  )
}

export async function EditorialDashboard({ payload, permissions, user }: Props) {
  if (!user) return null
  let data: DashboardData
  try {
    data = await loadDashboard(payload, user)
  } catch (err) {
    payload.logger.warn({ err }, 'Editorial dashboard could not load')
    return null
  }
  const admin = payload.config.routes.admin
  const posts = `${admin}/collections/posts`
  const can = permissions ?? {}
  const actions: Action[] = [
    {
      label: 'New post',
      href: `${posts}/create`,
      icon: FilePlus2,
      allowed: Boolean(can.collections?.posts?.create),
    },
    {
      label: 'New page',
      href: `${admin}/collections/pages/create`,
      icon: FileText,
      allowed: Boolean(can.collections?.pages?.create),
    },
    {
      label: 'Upload media',
      href: `${admin}/collections/media/create`,
      icon: ImageUp,
      allowed: Boolean(can.collections?.media?.create),
    },
    {
      label: 'Homepage layout',
      href: `${admin}/globals/homepage`,
      icon: LayoutTemplate,
      allowed: Boolean(can.globals?.homepage?.update),
    },
    {
      label: 'Header & menu',
      href: `${admin}/globals/header`,
      icon: Menu,
      allowed: Boolean(can.globals?.header?.update),
    },
    {
      label: 'Site settings',
      href: `${admin}/globals/site-settings`,
      icon: Settings,
      allowed: Boolean(can.globals?.['site-settings']?.update),
    },
  ]
  const draftsHref = `${posts}?where[_status][equals]=draft`
  const reviewHref = `${posts}?where[flags.needsReview][equals]=true`
  const stats = [
    { label: 'Published posts', value: data.stats.published, icon: Newspaper, href: posts },
    {
      label: data.ownDraftsOnly ? 'Your drafts' : 'Drafts',
      value: data.stats.drafts,
      icon: FilePen,
      href: draftsHref,
    },
    { label: 'Needs review', value: data.stats.needsReview, icon: Flag, href: reviewHref },
    { label: 'Pages', value: data.stats.pages, icon: FileText, href: `${admin}/collections/pages` },
    {
      label: 'Media files',
      value: data.stats.media,
      icon: Images,
      href: `${admin}/collections/media`,
    },
  ]
  const name = user.name || user.email || 'there'

  return (
    <section className="im-dash" aria-label="Editorial overview">
      <header className="im-dash__head">
        <div>
          <p className="im-dash__eyebrow">
            Islam Malayalam · {ROLE_LABEL[user.role ?? ''] ?? 'Staff'}
          </p>
          <h2 className="im-dash__title">Welcome back, {name}</h2>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="im-dash__site">
          View site
          <ExternalLink aria-hidden="true" />
        </a>
      </header>

      <ul className="im-dash__actions" aria-label="Quick actions">
        {actions
          .filter((a) => a.allowed)
          .map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="im-dash__action">
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
      </ul>

      <ul className="im-dash__stats" aria-label="Content totals">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <li key={label}>
            <Link href={href} className="im-dash__stat">
              <Icon aria-hidden="true" />
              <span className="im-dash__stat-value">{value.toLocaleString('en-IN')}</span>
              <span className="im-dash__stat-label">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="im-dash__lists">
        <Panel
          title={data.ownDraftsOnly ? 'Your recent drafts' : 'Recent drafts'}
          icon={FilePen}
          href={draftsHref}
        >
          <RowList rows={data.drafts} admin={admin} empty="No drafts — everything is published." />
        </Panel>
        <Panel title="Needs review" icon={Flag} href={reviewHref}>
          <RowList rows={data.review} admin={admin} empty="Nothing is waiting for review." />
        </Panel>
      </div>
    </section>
  )
}
