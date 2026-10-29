import type { FilterDef, FilterKind } from './listFields'
import { pickedValues, type Leaf } from './listQuery'

/**
 * Turning a field's conditions into a chip's text ("Last 30 days", "Q&A, Fiqh +1", "Yes") and
 * building the conditions each editor writes. Dates are whole days in the editor's own time zone.
 */

const RANGE_OPS = ['greater_than_equal', 'greater_than', 'less_than_equal', 'less_than', 'equals']

/** The operators each chip editor writes: a change replaces these and keeps any other condition. */
export const EDITOR_OPS: Record<FilterKind, readonly string[]> = {
  options: ['in', 'equals'],
  relation: ['in', 'equals'],
  boolean: ['equals', 'not_equals'],
  presence: ['exists'],
  date: RANGE_OPS,
  number: RANGE_OPS,
  text: ['like'],
}

// ---- Dates ---------------------------------------------------------------------------------------

export type DateRange = { from?: Date; to?: Date }
export type DatePreset = { key: string; label: string; range: (now: Date) => DateRange }

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const daysAgo = (now: Date, n: number) =>
  startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))

// Each "up to now" preset ends today: migrated posts can carry future dates (see flags.dateSuspect).
export const DATE_PRESETS: DatePreset[] = [
  { key: 'today', label: 'Today', range: (now) => ({ from: startOfDay(now), to: endOfDay(now) }) },
  { key: '7d', label: 'Last 7 days', range: (now) => ({ from: daysAgo(now, 6), to: endOfDay(now) }) },
  {
    key: '30d',
    label: 'Last 30 days',
    range: (now) => ({ from: daysAgo(now, 29), to: endOfDay(now) }),
  },
  {
    key: 'year',
    label: 'This year',
    range: (now) => ({ from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) }),
  },
  {
    key: 'last-year',
    label: 'Last year',
    range: (now) => ({
      from: new Date(now.getFullYear() - 1, 0, 1),
      to: endOfDay(new Date(now.getFullYear() - 1, 11, 31)),
    }),
  },
]

/** "2026-10-29" in local time, the value of an <input type="date">. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** An <input type="date"> value as a local date, or undefined when empty or invalid. */
export function fromDayKey(key: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function dateLeaves(path: string, { from, to }: DateRange): Leaf[] {
  return [
    ...(from ? [{ path, op: 'greater_than_equal', value: startOfDay(from).toISOString() }] : []),
    ...(to ? [{ path, op: 'less_than_equal', value: endOfDay(to).toISOString() }] : []),
  ]
}

const asDate = (v: unknown): Date | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** The day range a date field's conditions cover (after/before; equals counts as both). */
export function readDateRange(leaves: Leaf[]): DateRange {
  const range: DateRange = {}
  for (const { op, value } of leaves) {
    const d = asDate(value)
    if (!d) continue
    if (op === 'greater_than_equal' || op === 'greater_than') range.from = d
    else if (op === 'less_than_equal' || op === 'less_than') range.to = d
    else if (op === 'equals') {
      range.from = d
      range.to = d
    }
  }
  return range
}

const sameDay = (a?: Date, b?: Date) => (!a && !b) || (a && b && dayKey(a) === dayKey(b))

/** Which preset a range is, if any, so the chip can say "Last 30 days" instead of two dates. */
export function matchPreset(range: DateRange, now: Date): DatePreset | undefined {
  return DATE_PRESETS.find((p) => {
    const want = p.range(now)
    return sameDay(want.from, range.from) && sameDay(want.to, range.to)
  })
}

const dayText = (d: Date, withYear: boolean) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d)

export function describeDateRange(range: DateRange, now: Date): string | null {
  const { from, to } = range
  if (!from && !to) return null
  const preset = matchPreset(range, now)
  if (preset) return preset.label
  const thisYear = (d: Date) => d.getFullYear() === now.getFullYear()
  if (from && to) {
    if (dayKey(from) === dayKey(to)) return dayText(from, !thisYear(from))
    const years = !(thisYear(from) && thisYear(to))
    return `${dayText(from, years)} – ${dayText(to, years)}`
  }
  if (from) return `Since ${dayText(from, !thisYear(from))}`
  return `Until ${dayText(to!, !thisYear(to!))}`
}

// ---- Chip text -----------------------------------------------------------------------------------

/** "Q&A, Fiqh +1": at most two names, then how many more. */
export function summarize(names: string[]): string {
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

const OP_TEXT: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  like: 'contains',
  contains: 'contains',
  not_like: 'does not contain',
  in: 'is any of',
  not_in: 'is none of',
  exists: 'exists',
  greater_than: 'more than',
  greater_than_equal: 'at least',
  less_than: 'less than',
  less_than_equal: 'at most',
  near: 'near',
}

/** Boolean filters: true = Yes, false = No, undefined = not filtered. */
export function readBoolean(leaves: Leaf[]): boolean | undefined {
  for (const { op, value } of leaves) {
    const v = String(value)
    if (op === 'equals') return v === 'true'
    if (op === 'not_equals') return v !== 'true'
    if (op === 'exists') return v === 'true'
  }
  return undefined
}

export function booleanLeaves(path: string, value: boolean | undefined, kind: 'boolean' | 'presence'): Leaf[] {
  if (value === undefined) return []
  if (kind === 'presence') return [{ path, op: 'exists', value }]
  // "No" also matches items saved before the field existed (no value at all).
  return [{ path, op: value ? 'equals' : 'not_equals', value: true }]
}

export function readNumberRange(leaves: Leaf[]): { min?: number; max?: number } {
  const out: { min?: number; max?: number } = {}
  for (const { op, value } of leaves) {
    const n = Number(value)
    if (!Number.isFinite(n)) continue
    if (op === 'greater_than_equal' || op === 'greater_than') out.min = n
    else if (op === 'less_than_equal' || op === 'less_than') out.max = n
    else if (op === 'equals') out.min = out.max = n
  }
  return out
}

/**
 * The chip's text for a field's conditions, or null when the field is not filtered. `names` maps
 * ids to titles for relationship filters (the chip shows "1 selected" until they load).
 */
export function describeFilter(
  def: FilterDef,
  leaves: Leaf[],
  now: Date,
  names: Record<string, string> = {},
): string | null {
  if (leaves.length === 0) return null
  const simple = leaves.every((l) => ['in', 'equals'].includes(l.op))
  switch (def.kind) {
    case 'options':
      if (simple) {
        const picked = pickedValues(leaves)
        return summarize(picked.map((v) => def.options?.find((o) => o.value === v)?.label ?? v))
      }
      break
    case 'relation':
      if (simple) {
        const picked = pickedValues(leaves)
        const known = picked.filter((id) => names[id])
        if (known.length < picked.length)
          return picked.length === 1 ? '1 selected' : `${picked.length} selected`
        return summarize(known.map((id) => names[id]!))
      }
      break
    case 'boolean':
    case 'presence': {
      const value = readBoolean(leaves)
      if (value === undefined) break
      if (def.kind === 'presence') return value ? 'Added' : 'Missing'
      return value ? 'Yes' : 'No'
    }
    case 'date':
      return describeDateRange(readDateRange(leaves), now)
    case 'number': {
      const { min, max } = readNumberRange(leaves)
      if (min !== undefined && max !== undefined) return min === max ? `${min}` : `${min} to ${max}`
      if (min !== undefined) return `at least ${min}`
      if (max !== undefined) return `at most ${max}`
      break
    }
    case 'text':
      if (leaves.length === 1 && leaves[0]!.op === 'like') return `contains "${String(leaves[0]!.value)}"`
      break
  }
  return leaves
    .map(({ op, value }) => `${OP_TEXT[op] ?? op} ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(', ')
}
