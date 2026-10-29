import type { Where } from 'payload'

/**
 * The list toolbar's view of Payload's `where` filter: a flat list of conditions that are all ANDed
 * together. Chips and status tabs each own the conditions on their field and replace only those,
 * so they combine with each other and with Payload's own Advanced filters panel. Values may come
 * back from the URL as strings (true → "true", 12 → "12"), so comparisons go through String().
 */
export type Leaf = { path: string; op: string; value: unknown }

export type ParsedWhere = {
  /** Conditions ANDed together, in URL order. */
  leaves: Leaf[]
  /** OR groups or nesting the chips cannot show: only the Advanced panel can edit this filter. */
  advanced: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Leaves of one AND group, or null when it holds something chips cannot show (an inner OR). */
function flattenAnd(node: unknown): Leaf[] | null {
  if (!isRecord(node)) return null
  const out: Leaf[] = []
  for (const [key, val] of Object.entries(node)) {
    if (key === 'and' || key === 'or') {
      if (!Array.isArray(val)) return null
      // An OR of one condition is just that condition (Payload's builder writes filters that way).
      if (key === 'or' && val.length > 1) return null
      for (const child of val) {
        const inner = flattenAnd(child)
        if (!inner) return null
        out.push(...inner)
      }
      continue
    }
    if (!isRecord(val)) return null
    for (const [op, value] of Object.entries(val)) out.push({ path: key, op, value })
  }
  return out
}

export function parseWhere(where: Where | null | undefined): ParsedWhere {
  if (!isRecord(where) || Object.keys(where).length === 0) return { leaves: [], advanced: false }
  const leaves = flattenAnd(where)
  return leaves ? { leaves, advanced: false } : { leaves: [], advanced: true }
}

/**
 * Back to a `where`: `{ and: [...] }`. Payload's Advanced panel still shows these rows (it hoists
 * them into its `or`/`and` shape), but unlike that shape this one does not make Payload open the
 * panel on every reload of a filtered list.
 */
export function buildWhere(leaves: Leaf[]): Where {
  if (leaves.length === 0) return {}
  return { and: leaves.map(({ path, op, value }) => ({ [path]: { [op]: value } }) as Where) }
}

/** A condition with a value: Payload's builder adds rows with no value until one is picked. */
export const isSet = (leaf: Leaf): boolean =>
  leaf.value !== undefined &&
  leaf.value !== null &&
  leaf.value !== '' &&
  !(Array.isArray(leaf.value) && leaf.value.length === 0)

/** Replace every condition on `paths` with `next`, where the first of them stood (else at the end). */
export function replacePath(leaves: Leaf[], paths: string | string[], next: Leaf[]): Leaf[] {
  const owned = new Set(typeof paths === 'string' ? [paths] : paths)
  const at = leaves.findIndex((l) => owned.has(l.path))
  const rest = leaves.filter((l) => !owned.has(l.path))
  if (at === -1) return [...rest, ...next]
  return [...rest.slice(0, at), ...next, ...rest.slice(at)]
}

/**
 * An editor's change: replaces only the operators that editor writes on `path` and keeps any other
 * condition on it (say `not_in` from the Advanced panel), unlike replacePath.
 */
export function replaceOps(leaves: Leaf[], path: string, ops: readonly string[], next: Leaf[]): Leaf[] {
  const kept = leaves.filter((l) => l.path === path && !ops.includes(l.op))
  return replacePath(leaves, path, [...kept, ...next])
}

export const leavesFor = (leaves: Leaf[], path: string): Leaf[] =>
  leaves.filter((l) => l.path === path && isSet(l))

/**
 * The values an `in` / `equals` condition picks, as strings. Commas split URL-style `in` lists, and
 * a list of more than 20 comes back from the URL parser as an object keyed by position.
 */
export function pickedValues(leaves: Leaf[]): string[] {
  const out: string[] = []
  for (const { op, value } of leaves) {
    if (op === 'in') {
      const list = Array.isArray(value)
        ? value
        : isRecord(value)
          ? Object.values(value)
          : String(value).split(',')
      out.push(...list.map(String).filter(Boolean))
    } else if (op === 'equals' && value !== undefined && value !== null) out.push(String(value))
  }
  return [...new Set(out)]
}

/** `where[…]` query parameters for a REST call (the format Payload's qs parser reads). */
export function whereParams(where: Where, params = new URLSearchParams()): URLSearchParams {
  const walk = (value: unknown, key: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`))
    else if (isRecord(value)) for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`)
    else if (value !== undefined) params.append(key, String(value))
  }
  walk(where, 'where')
  return params
}

// ---- Status tabs ---------------------------------------------------------------------------------

export type ViewTab = { key: string; label: string; leaf: Leaf | null }

/**
 * All · Published · Drafts for collections with drafts, plus Needs review where the migration's
 * review flag exists. A collection with neither gets no tabs.
 */
export function viewTabs(paths: Set<string>): ViewTab[] {
  const tabs: ViewTab[] = []
  if (paths.has('_status'))
    tabs.push(
      { key: 'published', label: 'Published', leaf: { path: '_status', op: 'equals', value: 'published' } },
      { key: 'draft', label: 'Drafts', leaf: { path: '_status', op: 'equals', value: 'draft' } },
    )
  if (paths.has('flags.needsReview'))
    tabs.push({
      key: 'review',
      label: 'Needs review',
      leaf: { path: 'flags.needsReview', op: 'equals', value: true },
    })
  return tabs.length ? [{ key: 'all', label: 'All', leaf: null }, ...tabs] : []
}

export const tabPaths = (tabs: ViewTab[]): string[] => [
  ...new Set(tabs.flatMap((t) => (t.leaf ? [t.leaf.path] : []))),
]

/** The tab the filter is on: 'all' with no tab condition, null when it matches no single tab. */
export function activeTab(tabs: ViewTab[], leaves: Leaf[]): string | null {
  const owned = new Set(tabPaths(tabs))
  const mine = leaves.filter((l) => owned.has(l.path) && isSet(l))
  if (mine.length === 0) return 'all'
  if (mine.length > 1) return null
  const [only] = mine
  const hit = tabs.find(
    (t) =>
      t.leaf &&
      t.leaf.path === only!.path &&
      t.leaf.op === only!.op &&
      String(t.leaf.value) === String(only!.value),
  )
  return hit?.key ?? null
}

/** The filter after picking a tab: the tab's condition replaces any other tab condition. */
export function selectTab(tabs: ViewTab[], leaves: Leaf[], key: string): Leaf[] {
  const tab = tabs.find((t) => t.key === key)
  return replacePath(leaves, tabPaths(tabs), tab?.leaf ? [tab.leaf] : [])
}
