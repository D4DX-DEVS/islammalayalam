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
