import { istDayKey } from '@/lib/quote'

/**
 * Which Insights (quotes) are shown and in what order. Pure, so it is unit-tested.
 *
 *  - The order is the one set in the admin list (drag or arrows): the top row first.
 *  - One that has not been placed yet (no position) follows the placed ones, newest first.
 *  - One dated in the future ("Show on") stays hidden until that India day.
 */
export type QuoteLike = {
  id: string
  showOn?: string | null
  createdAt?: string | null
  /** Position key set by the admin's ordering (compared as plain text, like the database does). */
  _order?: string | null
}

/** The India day a quote counts from, "YYYY-MM-DD" (null only for a quote with no usable date at all). */
export const quoteDay = (q: QuoteLike): string | null =>
  istDayKey(q.showOn) ?? istDayKey(q.createdAt)

const created = (q: QuoteLike) => (q.createdAt ? new Date(q.createdAt).getTime() || 0 : 0)

export function showableQuotes<T extends QuoteLike>(quotes: T[], now: Date = new Date()): T[] {
  const today = istDayKey(now)
  if (!today) return []
  return quotes
    .filter((q) => (quoteDay(q) ?? '') <= today)
    .sort((a, b) => {
      const ao = a._order ?? ''
      const bo = b._order ?? ''
      if (ao && bo && ao !== bo) return ao < bo ? 1 : -1 // bigger key = higher in the list
      if (ao && !bo) return -1
      if (!ao && bo) return 1
      return created(b) - created(a) || b.id.localeCompare(a.id)
    })
}
