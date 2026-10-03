const DATE = new Intl.DateTimeFormat('ml-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

/** "20 സെപ്റ്റംബർ 2026" — day, Malayalam month, year (India time). ICU's own ml order is year-first. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    DATE.formatToParts(d).find((p) => p.type === type)?.value ?? ''
  return `${part('day')} ${part('month')} ${part('year')}`
}

/** "4 മിനിറ്റ് വായന" */
export const readingLabel = (minutes: number | null | undefined): string =>
  minutes && minutes > 0 ? `${minutes} മിനിറ്റ് വായന` : ''

/** Parse ?page= safely: positive integer, capped. Anything else → 1. */
export function parsePage(value: string | string[] | undefined, max = 10_000): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1
  const n = Number(raw)
  return n >= 1 && n <= max ? n : 1
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

/** Admin lists: "5 minutes ago", "yesterday", "just now". Empty for missing/invalid input. */
export function timeAgo(value: string | null | undefined, now = Date.now()): string {
  if (!value) return ''
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const seconds = Math.round((t - now) / 1000)
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.trunc(seconds / size), unit)
  }
  return 'just now'
}
