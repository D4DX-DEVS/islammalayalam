/**
 * What the list toolbar can filter and show, read from the collection's client fields: every
 * select, checkbox, relationship, date, number and text field (also inside groups, tabs and rows)
 * becomes a filter, and every table column gets a plain label and the group it belongs to.
 * Hidden, disabled and `disableListFilter` / `disableListColumn` fields are left out.
 */

export type FilterKind = 'options' | 'boolean' | 'relation' | 'presence' | 'date' | 'number' | 'text'
export type FilterOption = { label: string; value: string }
export type FilterDef = {
  path: string
  label: string
  /** The group or named tab the field sits in, e.g. "Flags". */
  group?: string
  kind: FilterKind
  options?: FilterOption[]
  relationTo?: string
}

/** The parts of a client field this file reads; Payload's union type is narrowed by `type`. */
type LooseField = {
  type: string
  name?: string
  label?: unknown
  hidden?: boolean
  virtual?: boolean | string
  hasMany?: boolean
  relationTo?: unknown
  options?: unknown[]
  fields?: LooseField[]
  tabs?: Array<{ name?: string; label?: unknown; fields?: LooseField[] }>
  admin?: { hidden?: boolean; disabled?: boolean; disableListFilter?: boolean; disableListColumn?: boolean }
}

/** "needsReview" → "Needs review", "publishedAt" → "Published at", "_status" → "Status". */
export function humanize(name: string): string {
  const words = name
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  if (words === 'id') return 'ID'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A label that may be a string or a per-language record; false or a function means "none". */
export function labelText(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label.trim()) return label
  if (label && typeof label === 'object') {
    const byLang = label as Record<string, unknown>
    const text = byLang.en ?? Object.values(byLang)[0]
    if (typeof text === 'string' && text.trim()) return text
  }
  return fallback
}

const fieldLabel = (f: LooseField) => labelText(f.label, humanize(f.name ?? ''))

/**
 * What Payload's own picker and builder leave out. `admin.hidden` is not one of them: it only keeps
 * a field off the edit form (createdAt, updatedAt and an upload's filename all have it).
 */
const isOff = (f: LooseField) => Boolean(f.hidden || f.admin?.disabled)

/**
 * The signed-in user's field permissions, as Payload sends them: `true` for "all", else per field
 * `true` or `{ read, fields }`. Undefined means not known yet (the server still enforces access).
 */
export type FieldPermissions = boolean | Record<string, unknown> | undefined

type PermEntry = true | { read?: unknown; fields?: FieldPermissions } | undefined

const entry = (perms: FieldPermissions, name: string): PermEntry =>
  perms && typeof perms === 'object' ? (perms[name] as PermEntry) : undefined

/** Same rule as Payload's filter builder: readable when everything or this field reads. */
function canRead(perms: FieldPermissions, name: string): boolean {
  if (perms === undefined || perms === true) return true
  if (perms === false) return false
  const e = entry(perms, name)
  return e === true || (typeof e === 'object' && e?.read === true)
}

const childPerms = (perms: FieldPermissions, name: string): FieldPermissions => {
  if (typeof perms !== 'object') return perms
  const e = entry(perms, name)
  if (e === true) return true
  return (typeof e === 'object' && (e.fields ?? (e as Record<string, unknown>))) || false
}

function optionList(options: unknown[] | undefined): FilterOption[] {
  return (options ?? []).flatMap((o) => {
    if (typeof o === 'string') return [{ label: o, value: o }]
    if (o && typeof o === 'object' && 'value' in o) {
      const { label, value } = o as { label?: unknown; value: unknown }
      return [{ label: labelText(label, String(value)), value: String(value) }]
    }
    return []
  })
}

function kindOf(f: LooseField): FilterKind | null {
  switch (f.type) {
    case 'select':
    case 'radio':
      return 'options'
    case 'checkbox':
      return 'boolean'
    case 'relationship':
      return typeof f.relationTo === 'string' ? 'relation' : null
    case 'upload':
      return typeof f.relationTo === 'string' && !f.hasMany ? 'presence' : null
    case 'date':
      return 'date'
    case 'number':
      return f.hasMany ? null : 'number'
    case 'text':
    case 'textarea':
    case 'email':
      return f.hasMany ? null : 'text'
    default:
      return null
  }
}

/** Filterable fields, in form order. `permissions` drops what the signed-in user may not read. */
export function filterDefs(fields: readonly unknown[], permissions?: FieldPermissions): FilterDef[] {
  const out: FilterDef[] = []
  const walk = (list: LooseField[] | undefined, prefix: string, perms: FieldPermissions, group?: string) => {
    for (const f of list ?? []) {
      // Virtual fields are computed, not stored: nothing to query.
      if (isOff(f) || f.virtual === true) continue
      if (f.type === 'tabs') {
        for (const tab of f.tabs ?? []) {
          if (tab.name)
            walk(
              tab.fields,
              `${prefix}${tab.name}.`,
              childPerms(perms, tab.name),
              labelText(tab.label, humanize(tab.name)),
            )
          else walk(tab.fields, prefix, perms, group)
        }
        continue
      }
      if (f.type === 'row' || f.type === 'collapsible' || (f.type === 'group' && !f.name)) {
        walk(f.fields, prefix, perms, group)
        continue
      }
      if (!f.name) continue
      if (f.type === 'group') {
        walk(f.fields, `${prefix}${f.name}.`, childPerms(perms, f.name), fieldLabel(f))
        continue
      }
      if (f.admin?.disableListFilter || !canRead(perms, f.name)) continue
      const kind = kindOf(f)
      if (!kind) continue
      out.push({
        path: `${prefix}${f.name}`,
        label: fieldLabel(f),
        ...(group ? { group } : {}),
        kind,
        ...(kind === 'options' ? { options: optionList(f.options) } : {}),
        ...(kind === 'relation' ? { relationTo: f.relationTo as string } : {}),
      })
    }
  }
  walk(fields as LooseField[], '', permissions)
  return out
}

const RANK: Record<FilterKind, number> = {
  options: 0,
  relation: 1,
  boolean: 2,
  presence: 3,
  date: 4,
  number: 5,
  text: 6,
}
const LATE_DATES = new Set(['createdAt', 'updatedAt'])
export const MAX_QUICK_FILTERS = 4

/**
 * The chips always shown: the collection's `admin.custom.listFilters` when set, else the most
 * useful top-level fields (choices, links to other items, yes/no, then dates). `exclude` holds the
 * fields the status tabs already cover.
 */
export function quickFilters(defs: FilterDef[], configured: unknown, exclude: string[]): FilterDef[] {
  const usable = defs.filter((d) => !exclude.includes(d.path))
  if (Array.isArray(configured)) {
    return configured.flatMap((path) => usable.filter((d) => d.path === path))
  }
  return usable
    .filter((d) => !d.group && d.kind !== 'text' && d.kind !== 'number' && d.kind !== 'presence')
    .map((d, i) => ({ d, i }))
    .sort(
      (a, b) =>
        RANK[a.d.kind] - RANK[b.d.kind] ||
        Number(LATE_DATES.has(a.d.path)) - Number(LATE_DATES.has(b.d.path)) ||
        a.i - b.i,
    )
    .slice(0, MAX_QUICK_FILTERS)
    .map(({ d }) => d)
}

// ---- Columns -------------------------------------------------------------------------------------

/** The parts of Payload's `Column` this file reads. */
export type ColumnLike = {
  accessor: string
  active: boolean
  field: unknown
}

export type ColumnItem = {
  accessor: string
  label: string
  /** The group the field sits in ("SEO", "Video"); null for top-level fields. */
  group: string | null
  active: boolean
  /** Position in Payload's full column state, which `moveColumn` indexes into. */
  index: number
}

/**
 * Columns the picker offers, in table order. Leaves out what Payload's own picker leaves out
 * (hidden, disabled, `disableListColumn`) and display-only fields with nothing to show in a cell,
 * unless the collection puts them in its default columns (row actions, move arrows).
 */
export function columnItems(columns: readonly ColumnLike[], defaults: readonly string[]): ColumnItem[] {
  const out: ColumnItem[] = []
  columns.forEach((col, index) => {
    const field = (col.field ?? {}) as LooseField & { labelWithPrefix?: unknown }
    const isId = field.name === 'id'
    if (!isId && isOff(field)) return
    if (field.admin?.disableListColumn) return
    if (field.type === 'ui' && !defaults.includes(col.accessor) && !col.active) return
    const dot = col.accessor.lastIndexOf('.')
    const own = labelText(field.label, humanize(field.name ?? col.accessor.slice(dot + 1)))
    const prefixed = typeof field.labelWithPrefix === 'string' ? field.labelWithPrefix : ''
    const parts = prefixed.split(' > ')
    const group =
      parts.length > 1 ? parts.slice(0, -1).join(' › ') : dot > 0 ? humanize(col.accessor.slice(0, dot)) : null
    out.push({ accessor: col.accessor, label: own, group, active: col.active, index })
  })
  return out
}

/** True when the shown columns are exactly the defaults, in order (Reset has nothing to do). */
export function isDefaultLayout(items: ColumnItem[], defaults: readonly string[]): boolean {
  if (!defaults.length) return true
  const shown = items.filter((i) => i.active).map((i) => i.accessor)
  const expected = defaults.filter((d) => items.some((i) => i.accessor === d))
  return shown.length === expected.length && shown.every((a, i) => a === expected[i])
}
