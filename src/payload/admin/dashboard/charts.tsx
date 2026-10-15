import Link from 'next/link'
import type { CSSProperties } from 'react'
import { full, niceScale, shareLabel, type DayCount } from '../dashboardStats'
import type { CategoryCount, FormatCount } from '../dashboardData'
import { Empty } from './parts'

/**
 * Dashboard charts, drawn with HTML + CSS (styles: app/(payload)/admin-dashboard.scss) so text stays
 * crisp and the layout flows on every screen width. They follow the data-viz rules: one colour for a
 * single series, thin marks with a rounded data end, hairline grid, labels only on the extremes, a
 * legend for the multi-series mix, and a table view next to every chart whose values aren't all
 * printed. Tooltips only repeat what the table and labels already say.
 */

type Column = {
  key: string
  label: string
  /** Shown instead of `label` on narrow screens (e.g. ’18 for 2018). */
  short?: string
  value: number
}

function TableView({
  heads,
  rows,
}: {
  heads: [string, string]
  rows: Array<[string, string | number]>
}) {
  return (
    <details className="im-viz__table">
      <summary>View as table</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{heads[0]}</th>
            <th scope="col">{heads[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{typeof value === 'number' ? full(value) : value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** Single-series columns (e.g. posts per year). The peak and the last column carry a value label. */
export function ColumnChart({
  columns,
  noun,
  heads,
}: {
  columns: Column[]
  /** "post" → "166 posts" in the tooltip / screen-reader name. */
  noun: string
  heads: [string, string]
}) {
  const peak = Math.max(0, ...columns.map((c) => c.value))
  if (!columns.length || peak === 0) return <Empty>Nothing to chart yet.</Empty>
  const scale = niceScale(peak)
  const peakAt = columns.findIndex((c) => c.value === peak)
  const lastAt = columns.length - 1
  const name = (c: Column) => `${c.label}: ${full(c.value)} ${noun}${c.value === 1 ? '' : 's'}`

  return (
    <figure className="im-viz">
      <div className="im-viz__plot">
        <div className="im-viz__grid" aria-hidden="true">
          {scale.ticks.map((tick, i) => (
            <span
              key={tick}
              className="im-viz__line"
              style={{ bottom: `${(i / (scale.ticks.length - 1)) * 100}%` }}
            >
              <span>{full(tick)}</span>
            </span>
          ))}
        </div>
        <ol className="im-viz__cols" style={{ '--n': columns.length } as CSSProperties}>
          {columns.map((c, i) => (
            <li key={c.key} className="im-viz__slot" tabIndex={0} aria-label={name(c)}>
              <span
                className={`im-viz__bar${c.value === 0 ? ' im-viz__bar--zero' : ''}`}
                style={{ height: `${(c.value / scale.max) * 100}%` }}
                aria-hidden="true"
              >
                {i === peakAt || i === lastAt ? (
                  <span className="im-viz__val">{full(c.value)}</span>
                ) : null}
              </span>
              <span className={`im-viz__x${c.short ? ' im-viz__x--short' : ''}`} aria-hidden="true">
                <span className="im-viz__x-full">{c.label}</span>
                {c.short ? <span className="im-viz__x-short">{c.short}</span> : null}
              </span>
              <span className="im-viz__tip" aria-hidden="true">
                {name(c)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <TableView heads={heads} rows={columns.map((c) => [c.label, c.value])} />
    </figure>
  )
}

/** Part-to-whole of a handful of formats: one stacked bar (2px gaps) + a legend that prints every value. */
export function FormatMix({ formats, admin }: { formats: FormatCount[]; admin: string }) {
  const total = formats.reduce((sum, f) => sum + f.count, 0)
  if (total === 0) return <Empty>No published posts yet.</Empty>
  const summary = formats.map((f) => `${f.label} ${full(f.count)}`).join(', ')

  return (
    <div className="im-mix">
      <div className="im-mix__bar" role="img" aria-label={`Published posts by format: ${summary}`}>
        {formats
          .filter((f) => f.count > 0)
          .map((f) => (
            <span
              key={f.key}
              className={`im-mix__seg im-mix__seg--${f.key}`}
              style={{ flexGrow: f.count }}
            >
              {f.count / total >= 0.15 ? shareLabel(f.count, total) : null}
            </span>
          ))}
      </div>
      <ul className="im-mix__legend">
        {formats.map((f) => (
          <li key={f.key}>
            <Link
              href={`${admin}/collections/posts?where[format][equals]=${f.key}&where[_status][equals]=published`}
              className="im-mix__item"
            >
              <span className={`im-mix__swatch im-mix__swatch--${f.key}`} aria-hidden="true" />
              <span className="im-mix__name">{f.label}</span>
              <strong>{full(f.count)}</strong>
              <span className="im-mix__share">{shareLabel(f.count, total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ranked horizontal bars, one colour (the categories have no order), the count at each tip. */
export function CategoryBars({
  rows,
  admin,
  limit = 8,
}: {
  rows: CategoryCount[]
  admin: string
  limit?: number
}) {
  if (!rows.length) return <Empty>No categories yet.</Empty>
  const top = rows.slice(0, limit)
  const max = Math.max(1, ...top.map((c) => c.posts))
  return (
    <>
      <ul className="im-bars">
        {top.map((c) => (
          <li key={c.id}>
            <Link
              href={`${admin}/collections/posts?where[primaryCategory][equals]=${c.id}`}
              className="im-bars__row"
            >
              <span className="im-bars__top">
                <span className="im-bars__name">{c.name}</span>
                <span className="im-bars__count">{full(c.posts)}</span>
              </span>
              <span className="im-bars__track" aria-hidden="true">
                <span
                  className="im-bars__fill"
                  style={{ width: `${c.posts > 0 ? Math.max(2, (c.posts / max) * 100) : 0}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > limit ? (
        <p className="im-bars__more">
          + {rows.length - limit} more {rows.length - limit === 1 ? 'category' : 'categories'}
        </p>
      ) : null}
    </>
  )
}

/** A compact per-day strip (the audit trail's pulse). Only the end dates are labelled. */
export function Pulse({ days, noun }: { days: DayCount[]; noun: string }) {
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const max = Math.max(1, ...days.map((d) => d.count))
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return null
  return (
    <div className="im-pulse">
      <p className="im-pulse__sum">
        <strong>{full(total)}</strong> {noun}
        {total === 1 ? '' : 's'} in the last {days.length} days
      </p>
      <ol className="im-pulse__cols" aria-hidden="true">
        {days.map((d) => (
          <li key={d.key} title={`${d.label}: ${d.count}`}>
            <span
              className={d.count === 0 ? 'im-pulse__bar im-pulse__bar--zero' : 'im-pulse__bar'}
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </li>
        ))}
      </ol>
      <p className="im-pulse__axis" aria-hidden="true">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </p>
      <TableView heads={['Day', 'Actions']} rows={days.map((d) => [d.label, d.count])} />
    </div>
  )
}
