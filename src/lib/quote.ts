const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Index of today's quote: one per calendar day in India, cycling through the list. Stable for the
 * whole day (every visitor and every server sees the same quote) and changes at IST midnight.
 */
export function quoteIndexForDate(count: number, date: Date = new Date()): number {
  if (!Number.isInteger(count) || count <= 0) return -1
  const [y, m, d] = IST_DATE.format(date).split('-').map(Number)
  const day = Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000)
  return ((day % count) + count) % count
}

/** "2026-10-16" for the India calendar day of `value`; null when it is empty or not a date. */
export function istDayKey(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : IST_DATE.format(d)
}
