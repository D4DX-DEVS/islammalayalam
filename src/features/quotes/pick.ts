import { istDayKey, quoteIndexForDate } from '@/lib/quote'

/**
 * Which quote is "the daily quote". Pure, so it is unit-tested; the same answer for every visitor
 * for the whole India day.
 *
 *  1. A quote scheduled for today (several: the newest one).
 *  2. Otherwise one per day from the quotes with no date, cycling through them (oldest first).
 *  3. Otherwise the most recent quote whose date has passed, so the slot never goes blank once
 *     a dated run of quotes ends. Quotes dated in the future are never shown early.
 */
export type QuoteLike = { id: string; showOn?: string | null; createdAt?: string | null }

const created = (q: QuoteLike) => (q.createdAt ? new Date(q.createdAt).getTime() || 0 : 0)
const byCreated = (a: QuoteLike, b: QuoteLike) =>
  created(a) - created(b) || a.id.localeCompare(b.id)

export function pickDailyQuote<T extends QuoteLike>(quotes: T[], now: Date = new Date()): T | null {
  const today = istDayKey(now)
  if (!today) return null
  const dated = quotes.flatMap((q) => {
    const day = istDayKey(q.showOn)
    return day ? [{ q, day }] : []
  })

  const scheduled = dated.filter((d) => d.day === today).map((d) => d.q)
  if (scheduled.length) return scheduled.sort(byCreated).at(-1)!

  const rotation = quotes.filter((q) => !istDayKey(q.showOn)).sort(byCreated)
  if (rotation.length) return rotation[quoteIndexForDate(rotation.length, now)]!

  const past = dated.filter((d) => d.day < today).sort((a, b) => a.day.localeCompare(b.day))
  return past.at(-1)?.q ?? null
}
