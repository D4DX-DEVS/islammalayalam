import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { ActivityRow, CategoryCount, DashboardRow, MessageRow } from '../dashboardData'

/** Building blocks of the admin dashboard (styles: app/(payload)/admin-dashboard.scss). */

export function Panel({
  title,
  icon: Icon,
  href,
  hrefLabel = 'View all',
  children,
}: {
  title: string
  icon: LucideIcon
  href?: string
  hrefLabel?: string
  children: ReactNode
}) {
  return (
    <section className="im-dash__panel">
      <header className="im-dash__panel-head">
        <h2>
          <span className="im-dash__panel-icon">
            <Icon aria-hidden="true" />
          </span>
          {title}
        </h2>
        {href ? <Link href={href}>{hrefLabel}</Link> : null}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="im-dash__empty">{children}</p>
}

export function PostRows({
  rows,
  admin,
  empty,
}: {
  rows: DashboardRow[]
  admin: string
  empty: string
}) {
  if (!rows.length) return <Empty>{empty}</Empty>
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

export function MessageRows({ rows, admin }: { rows: MessageRow[]; admin: string }) {
  if (!rows.length) return <Empty>No messages yet.</Empty>
  return (
    <ul className="im-dash__rows">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`${admin}/collections/contact-messages/${m.id}`} className="im-dash__row">
            <span className="im-dash__row-title">{m.subject}</span>
            <span className="im-dash__row-meta">
              {m.status === 'new' ? (
                <span className="im-dash__badge im-dash__badge--draft">New</span>
              ) : null}
              <span>{m.name}</span>
              {m.createdAt ? <span>{timeAgo(m.createdAt)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function CategoryBars({ rows, admin }: { rows: CategoryCount[]; admin: string }) {
  if (!rows.length) return <Empty>No categories yet.</Empty>
  return (
    <ul className="im-dash__cats">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`${admin}/collections/posts?where[primaryCategory][equals]=${c.id}`}
            className="im-dash__cat"
          >
            <span className="im-dash__cat-name">{c.name}</span>
            <span className="im-dash__cat-count">{c.posts.toLocaleString('en-IN')}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const VERB: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  login: 'signed in',
  publish: 'published',
  unpublish: 'unpublished',
  'mfa-lockout': 'was locked out (2FA)',
}

export function ActivityRows({ rows, admin }: { rows: ActivityRow[]; admin: string }) {
  if (!rows.length) return <Empty>No activity recorded yet.</Empty>
  return (
    <ol className="im-dash__activity">
      {rows.map((a) => {
        const what = a.action === 'login' || a.action === 'mfa-lockout' ? '' : ` ${a.target}`
        const linkable = a.docId && a.action !== 'delete' && a.target
        const text = (
          <>
            <strong>{a.who}</strong> {VERB[a.action] ?? a.action}
            {what}
          </>
        )
        return (
          <li key={a.id}>
            <span className={`im-dash__dot im-dash__dot--${a.action}`} aria-hidden="true" />
            <span className="im-dash__activity-text">
              {linkable ? (
                <Link href={`${admin}/collections/${a.target}/${a.docId}`}>{text}</Link>
              ) : (
                text
              )}
              <time dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
