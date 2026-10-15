import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, MinusCircle, type LucideIcon } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { ActivityRow, DashboardRow, MessageRow } from '../dashboardData'
import { compact, full } from '../dashboardStats'

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
  /** "On" / "Off" — always spelled out; the icon only backs it up. */
  state: 'on' | 'off'
  detail: string
  href?: string | null
}

/** The few switches editors ask about: each row is icon + words, never colour alone. */
export function StatusRows({ rows }: { rows: StatusRow[] }) {
  return (
    <ul className="im-status">
      {rows.map((row) => {
        const body = (
          <>
            <span className={`im-status__icon im-status__icon--${row.state}`} aria-hidden="true">
              {row.state === 'on' ? <CheckCircle2 /> : <MinusCircle />}
            </span>
            <span className="im-status__text">
              <span className="im-status__label">{row.label}</span>
              <span className="im-status__detail">
                <strong>{row.state === 'on' ? 'On' : 'Off'}</strong> · {row.detail}
              </span>
            </span>
          </>
        )
        return (
          <li key={row.label}>
            {row.href ? (
              <Link href={row.href} className="im-status__row">
                {body}
              </Link>
            ) : (
              <div className="im-status__row">{body}</div>
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
