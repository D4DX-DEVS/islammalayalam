/**
 * Pure helpers behind the admin dashboard's figures and charts (no Payload, no I/O) so the day /
 * year bucketing, percentages and axis scales are unit-tested. All calendar maths is India time,
 * the same zone the greeting and the site use.
 */
export const TZ = 'Asia/Kolkata'

const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const GROUPED = new Intl.NumberFormat('en-IN')

type DateInput = string | number | Date | null | undefined

/** "2026-10-15" for the India calendar day of `value`; null when it is empty or not a date. */
export function dayKey(value: DateInput): string | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : DAY_KEY.format(d)
}

export type DayCount = { key: string; label: string; count: number }

/** Counts per India calendar day for the `days` days ending today (oldest first, zeros included). */
export function dailyCounts(dates: DateInput[], days: number, now: Date = new Date()): DayCount[] {
  const span = Math.max(1, Math.floor(days))
  const buckets = new Map<string, DayCount>()
  // India has no daylight saving, so stepping back in 24-hour units lands on the previous day.
  for (let i = span - 1; i >= 0; i -= 1) {
    const at = new Date(now.getTime() - i * 86_400_000)
    const key = DAY_KEY.format(at)
    buckets.set(key, { key, label: DAY_LABEL.format(at), count: 0 })
  }
  for (const value of dates) {
    const key = dayKey(value)
    const bucket = key ? buckets.get(key) : undefined
    if (bucket) bucket.count += 1
  }
  return [...buckets.values()]
}

export type YearCount = { year: number; count: number }

/**
 * Counts per India calendar year from the first year with data to the current year, so a run of
 * empty years shows as zeros instead of vanishing. Only the last `maxYears` years are returned;
 * older dates are not counted.
 */
export function yearCounts(dates: DateInput[], now: Date = new Date(), maxYears = 10): YearCount[] {
  const years: number[] = []
  for (const value of dates) {
    const key = dayKey(value)
    if (key) years.push(Number(key.slice(0, 4)))
  }
  if (!years.length) return []
  const current = Number(DAY_KEY.format(now).slice(0, 4))
  const first = Math.max(Math.min(...years), current - Math.max(1, maxYears) + 1)
  const out: YearCount[] = []
  for (let year = first; year <= current; year += 1) out.push({ year, count: 0 })
  for (const year of years) {
    const bucket = out[year - first]
    if (bucket && year >= first && year <= current) bucket.count += 1
  }
  return out
}

/** The newest of `dates` as an ISO string, or null when there is none. */
export function latestDate(dates: DateInput[]): string | null {
  let best = -Infinity
  for (const value of dates) {
    if (value === null || value === undefined || value === '') continue
    const t = (value instanceof Date ? value : new Date(value)).getTime()
    if (!Number.isNaN(t) && t > best) best = t
  }
  return Number.isFinite(best) ? new Date(best).toISOString() : null
}

/** A readable share: "0%", "<1%", "1.4%", "91%". */
export function shareLabel(part: number, total: number): string {
  if (!(total > 0) || !(part > 0)) return '0%'
  const pct = (part / total) * 100
  if (pct < 1) return '<1%'
  if (pct < 10) return `${Math.round(pct * 10) / 10}%`
  return `${Math.round(pct)}%`
}

/** 1,284 · 12.9K · 1.2M — full digits below 10,000, compact above. */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.abs(value) < 10_000 ? GROUPED.format(value) : COMPACT.format(value)
}

/** Full-digit form, for titles and screen readers: 12,934. */
export const full = (value: number): string => GROUPED.format(Number.isFinite(value) ? value : 0)

/** An axis for counts: a round maximum and evenly spaced whole-number ticks from 0. */
export function niceScale(max: number, steps = 4): { max: number; ticks: number[] } {
  const count = Math.max(1, Math.floor(steps))
  const top = Number.isFinite(max) && max > 0 ? max : 0
  if (top === 0) return { max: 1, ticks: [0, 1] }
  const raw = Math.max(1, top / count)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude)
  const ticks: number[] = []
  for (let value = 0; value < top + step; value += step) {
    ticks.push(value)
    if (value >= top) break
  }
  return { max: ticks[ticks.length - 1]!, ticks }
}

export type PlotPoint = [number, number]

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * An SVG path through `points` (x ascending) that is smooth but never overshoots them, so a day
 * with nothing published never dips below the axis and a peak is never drawn taller than it is
 * (Fritsch–Carlson monotone cubic interpolation, written as cubic Béziers).
 */
export function monotonePath(points: PlotPoint[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${round2(points[0]![0])} ${round2(points[0]![1])}`
  const run: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1]![0] - points[i]![0]
    run.push(dx)
    slope.push(dx === 0 ? 0 : (points[i + 1]![1] - points[i]![1]) / dx)
  }
  const tangent: number[] = [slope[0]!]
  for (let i = 1; i < n - 1; i += 1) {
    const before = slope[i - 1]!
    const after = slope[i]!
    tangent.push(before * after <= 0 ? 0 : (before + after) / 2)
  }
  tangent.push(slope[n - 2]!)
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i]! / slope[i]!
    const b = tangent[i + 1]! / slope[i]!
    const size = a * a + b * b
    if (size > 9) {
      const tau = 3 / Math.sqrt(size)
      tangent[i] = tau * a * slope[i]!
      tangent[i + 1] = tau * b * slope[i]!
    }
  }
  const d = [`M ${round2(points[0]![0])} ${round2(points[0]![1])}`]
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[i + 1]!
    const third = run[i]! / 3
    d.push(
      `C ${round2(x0 + third)} ${round2(y0 + tangent[i]! * third)} ${round2(x1 - third)} ${round2(y1 - tangent[i + 1]! * third)} ${round2(x1)} ${round2(y1)}`,
    )
  }
  return d.join(' ')
}

/**
 * Which of `n` evenly spaced axis labels to print so that about `want` show: always the first and
 * the last, the rest a whole number of steps apart and never closer than half a step to the last.
 */
export function axisLabelIndexes(n: number, want = 5): Set<number> {
  const last = Math.max(0, Math.floor(n) - 1)
  const picked = new Set<number>([0, last])
  if (last === 0) return picked
  const step = Math.max(1, Math.round(last / Math.max(1, want - 1)))
  for (let i = step; i < last; i += step) if (last - i >= step / 2) picked.add(i)
  return picked
}

/** `values` summed into `groups` consecutive buckets of (nearly) equal size, in order. */
export function bucketSums(values: number[], groups: number): number[] {
  if (!values.length) return []
  const count = Math.max(1, Math.min(Math.floor(groups), values.length))
  const out = new Array<number>(count).fill(0)
  values.forEach((v, i) => {
    out[Math.min(count - 1, Math.floor((i * count) / values.length))]! += v
  })
  return out
}
