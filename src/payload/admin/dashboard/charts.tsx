import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  axisLabelIndexes,
  full,
  monotonePath,
  niceScale,
  shareLabel,
  type DayCount,
  type PlotPoint,
} from '../dashboardStats'
import type { FormatCount } from '../dashboardData'
import { Empty } from './parts'

/**
 * Dashboard charts (styles: app/(payload)/styles/dashboard.scss). Lines and areas are SVG in a
 * 100 × 100 box stretched to the plot (so they follow every width); grid lines, axis labels, points
 * and tooltips are HTML, so text stays crisp. One colour per single series, a hairline grid, labels
 * on the extremes only, and a table view next to every chart whose values are not all printed.
 */
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

const fmt = (n: number) => Math.round(n * 100) / 100

/** Points for `values` in the 100 × 100 box, the first at the left edge and the last at the right. */
function plotPoints(values: number[], max: number): PlotPoint[] {
  const n = values.length
  return values.map((v, i) => [
    fmt(n === 1 ? 50 : (i / (n - 1)) * 100),
    fmt(100 - (Math.max(0, v) / max) * 100),
  ])
}

/** A tiny trend line for a stat card: no axes, no labels (the card's words carry the meaning). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const points = plotPoints(values, max)
  const line = monotonePath(points)
  return (
    <svg className="im-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="im-spark__area" d={`${line} L 100 100 L 0 100 Z`} />
      <path className="im-spark__line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Posts per day over the last weeks: an area line with a point (and tooltip) for every day. */
export function TrendLine({ days, noun }: { days: DayCount[]; noun: string }) {
  if (!days.length) return <Empty>Nothing to chart yet.</Empty>
  const peak = Math.max(0, ...days.map((d) => d.count))
  const scale = niceScale(peak, 3)
  const points = plotPoints(
    days.map((d) => d.count),
    scale.max,
  )
  const line = monotonePath(points)
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const name = (d: DayCount) => `${d.label}: ${full(d.count)} ${noun}${d.count === 1 ? '' : 's'}`
  const labelled = axisLabelIndexes(days.length)

  return (
    <figure className="im-trend" style={{ '--n': days.length } as CSSProperties}>
      <div
        className="im-trend__plot"
        role="img"
        aria-label={`${full(total)} ${noun}${total === 1 ? '' : 's'} over ${days.length} days, peak ${full(peak)}`}
      >
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
        {peak > 0 ? (
          <svg
            className="im-trend__svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="im-trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" className="im-trend__stop im-trend__stop--top" />
                <stop offset="1" className="im-trend__stop im-trend__stop--bottom" />
              </linearGradient>
            </defs>
            <path className="im-trend__area" d={`${line} L 100 100 L 0 100 Z`} />
            <path className="im-trend__line" d={line} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        <ol className="im-trend__pts" aria-hidden="true">
          {days.map((d, i) => (
            <li
              key={d.key}
              className={d.count === peak && peak > 0 ? 'im-trend__pt im-trend__pt--peak' : 'im-trend__pt'}
              style={{ '--x': `${points[i]![0]}%`, '--y': `${points[i]![1]}%` } as CSSProperties}
            >
              <span className="im-trend__dot" />
              <span className="im-trend__tip">{name(d)}</span>
            </li>
          ))}
        </ol>
      </div>
      <ol className="im-trend__axis" aria-hidden="true">
        {days.map((d, i) => (
          <li key={d.key}>{labelled.has(i) ? d.label : ''}</li>
        ))}
      </ol>
      <TableView heads={['Day', `${noun[0]!.toUpperCase()}${noun.slice(1)}s`]} rows={days.map((d) => [d.label, d.count])} />
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

export type RankRow = { id: string; name: string; count: number; href: string }

/** Ranked horizontal bars (one colour: the rows have no order of their own), the count at each tip. */
export function RankBars({
  rows,
  limit = 6,
  more,
  avatars = false,
}: {
  rows: RankRow[]
  limit?: number
  /** "category" → "+ 3 more categories". */
  more: string
  /** Show a lettered avatar before each name (people). */
  avatars?: boolean
}) {
  if (!rows.length) return <Empty>Nothing to rank yet.</Empty>
  const top = rows.slice(0, limit)
  const max = Math.max(1, ...top.map((r) => r.count))
  const rest = rows.length - top.length
  return (
    <>
      <ol className="im-bars">
        {top.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="im-bars__row">
              {avatars ? (
                <span className="im-avatar im-avatar--sm" aria-hidden="true">
                  {r.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
              ) : null}
              <span className="im-bars__body">
                <span className="im-bars__top">
                  <span className="im-bars__name">{r.name}</span>
                  <span className="im-bars__count">{full(r.count)}</span>
                </span>
                <span className="im-bars__track" aria-hidden="true">
                  <span
                    className="im-bars__fill"
                    style={{ width: `${r.count > 0 ? Math.max(2, (r.count / max) * 100) : 0}%` }}
                  />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {rest > 0 ? (
        <p className="im-bars__more">
          + {rest} more {rest === 1 ? more : `${more.replace(/y$/, 'ie')}s`}
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
