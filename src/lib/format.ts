const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

/** "20 September 2026" — day, English month, year (India time). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d)
}

/**
 * The footer's copyright line without the site's own name: the logo above already says it, so
 * "© Islam Malayalam. All rights reserved." reads "© All rights reserved.".
 */
export function withoutSiteName(
  text: string | null | undefined,
  names: Array<string | null | undefined>,
): string {
  let out = text ?? ''
  for (const name of names) {
    const n = name?.trim()
    if (n) out = out.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
  }
  return out
    .replace(/\s+([.,;:])/g, '$1') // "© ." → "©."
    .replace(/(©)\s*[.,;:]+\s*/g, '$1 ') // "©. All" → "© All"
    .replace(/\s{2,}/g, ' ')
    .trim()
}

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
