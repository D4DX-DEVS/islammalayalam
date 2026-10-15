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
