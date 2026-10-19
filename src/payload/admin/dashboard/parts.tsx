import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, Info, type LucideIcon } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { ActivityRow, DashboardRow } from '../dashboardData'
import { compact, full } from '../dashboardStats'

/** Building blocks of the admin dashboard (styles: app/(payload)/admin-dashboard.scss). */

export function Panel({
  title,
  icon: Icon,
  href,
  hrefLabel = 'View all',
  aside,
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  href?: string
  hrefLabel?: string
  /** Shown at the right of the heading (a count, a switch). */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`im-dash__panel${className ? ` ${className}` : ''}`}>
      <header className="im-dash__panel-head">
        <h2>
          {Icon ? (
            <span className="im-dash__panel-icon">
              <Icon aria-hidden="true" />
            </span>
          ) : null}
          {title}
        </h2>
        {aside}
        {href ? <Link href={href}>{hrefLabel}</Link> : null}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="im-dash__empty">{children}</p>
}

/** Status as a dot and a word, so it never depends on colour alone. */
export function StatusChip({ row }: { row: Pick<DashboardRow, 'status' | 'needsReview'> }) {
  const tone = row.status === 'published' ? 'ok' : row.needsReview ? 'warn' : 'draft'
  const label =
    row.status === 'published' ? 'Published' : row.needsReview ? 'Needs review' : 'Draft'
  return (
    <span className={`im-chip im-chip--${tone}`}>
      <span className="im-chip__dot" aria-hidden="true" />
      {label}
    </span>
  )
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
            <span className="im-dash__row-main">
              <span className="im-dash__row-title">{row.title}</span>
              <span className="im-dash__row-meta">
                {row.postNumber ? <span>#{row.postNumber}</span> : null}
                {row.updatedAt ? <span>Edited {timeAgo(row.updatedAt)}</span> : null}
              </span>
            </span>
            {row.category ? <span className="im-dash__row-cat">{row.category}</span> : null}
            <StatusChip row={row} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export type StatFlag = { tone: 'warn' | 'info'; label: string }

/** A headline figure: label, value (compact above 10,000, full digits on hover), a context line, an optional flag. */
export function StatTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
  flag,
}: {
  label: string
  value: number
  hint?: string
  href: string
  icon: LucideIcon
  flag?: StatFlag | null
}) {
  const FlagIcon = flag?.tone === 'warn' ? AlertTriangle : Info
  return (
    <Link href={href} className="im-dash__stat">
      <span className="im-dash__stat-top">
        <span className="im-dash__stat-icon">
          <Icon aria-hidden="true" />
        </span>
        {flag ? (
          <span className={`im-dash__flag im-dash__flag--${flag.tone}`}>
            <FlagIcon aria-hidden="true" />
            {flag.label}
          </span>
        ) : null}
      </span>
      <span className="im-dash__stat-value" title={full(value)}>
        {compact(value)}
      </span>
      <span className="im-dash__stat-label">{label}</span>
      {hint ? <span className="im-dash__stat-hint">{hint}</span> : null}
    </Link>
  )
}

export type StatusRow = {
  label: string
  /** "On" / "Off" — always spelled out; the dot only backs it up. */
  state: 'on' | 'off'
  detail: string
  href?: string | null
}

/** The few switches editors ask about, as a strip of cards: dot + word, never colour alone. */
export function StatusStrip({ rows }: { rows: StatusRow[] }) {
  return (
    <ul className="im-status">
      {rows.map((row) => {
        const body = (
          <>
            <span className="im-status__top">
              <span className={`im-status__dot im-status__dot--${row.state}`} aria-hidden="true" />
              <span className="im-status__label">{row.label}</span>
              <span className="im-status__state">{row.state === 'on' ? 'On' : 'Off'}</span>
            </span>
            <span className="im-status__detail">{row.detail}</span>
          </>
        )
        return (
          <li key={row.label}>
            {row.href ? (
              <Link href={row.href} className="im-status__card">
                {body}
              </Link>
            ) : (
              <div className="im-status__card">{body}</div>
            )}
          </li>
        )
      })}
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
