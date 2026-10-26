/**
 * The admin sidebar's structure as plain data (no Payload, no React), so the grouping, the order and
 * the permission rules are unit-tested. Jobs, not data types: Write, Library, Inbox, Site, Team, with
 * the rarely used Advanced tools (redirects, activity log, migration) tucked away at the bottom.
 *
 * Item names come from each collection's / global's own label (set next to its config), so the
 * sidebar, the list headings and the breadcrumbs always use the same word. Only entries that are not
 * a collection or global (Website manager) are named here.
 */
export type NavKind = 'collection' | 'global' | 'view'

export type NavEntity = { slug: string; kind: 'collection' | 'global'; label: string }

export type NavItemData = {
  /** Unique within the sidebar: `<kind>:<slug>`. */
  key: string
  /** Path under the admin route, e.g. `/collections/posts`. */
  href: string
  label: string
  /** Unread / waiting count shown as a gold pill; absent or 0 shows nothing. */
  badge?: number
  slug: string
  kind: NavKind
}

export type NavGroupData = {
  key: string
  label: string
  items: NavItemData[]
  /** Starts folded away behind a single row (rarely used; admins only in practice). */
  tucked?: boolean
}

type LayoutEntry = { kind: NavKind; slug: string; label?: string }
type LayoutGroup = { key: string; label: string; tucked?: boolean; items: LayoutEntry[] }

/** Group names also live on each config's `admin.group`; tests keep the two in step. */
export const NAV_GROUP_LABELS = {
  write: 'Write',
  library: 'Library',
  inbox: 'Inbox',
  site: 'Site',
  team: 'Team',
  advanced: 'Advanced',
} as const

const LAYOUT: LayoutGroup[] = [
  {
    key: 'write',
    label: NAV_GROUP_LABELS.write,
    items: [
      { kind: 'collection', slug: 'posts' },
      { kind: 'collection', slug: 'pages' },
      { kind: 'collection', slug: 'categories' },
      { kind: 'collection', slug: 'authors' },
    ],
  },
  {
    key: 'library',
    label: NAV_GROUP_LABELS.library,
    items: [
      { kind: 'collection', slug: 'audios' },
      { kind: 'collection', slug: 'videos' },
      { kind: 'collection', slug: 'quotes' },
      { kind: 'collection', slug: 'media' },
    ],
  },
  {
    key: 'inbox',
    label: NAV_GROUP_LABELS.inbox,
    items: [
      { kind: 'collection', slug: 'contact-messages' },
      { kind: 'collection', slug: 'postal-requests' },
    ],
  },
  {
    key: 'site',
    label: NAV_GROUP_LABELS.site,
    items: [
      { kind: 'view', slug: 'website', label: 'Website manager' },
      { kind: 'global', slug: 'homepage' },
      { kind: 'global', slug: 'header' },
      { kind: 'global', slug: 'footer' },
      { kind: 'global', slug: 'site-settings' },
      { kind: 'global', slug: 'ads-banners' },
    ],
  },
  {
    key: 'team',
    label: NAV_GROUP_LABELS.team,
    items: [
      { kind: 'collection', slug: 'users' },
      { kind: 'global', slug: 'security-settings' },
    ],
  },
  {
    // Technical lists an everyday editor never needs: folded behind one row.
    key: 'advanced',
    label: 'Advanced tools',
    tucked: true,
    items: [
      { kind: 'collection', slug: 'redirects' },
      { kind: 'collection', slug: 'audit-logs' },
      { kind: 'collection', slug: 'migration-runs' },
      { kind: 'collection', slug: 'migration-issues' },
    ],
  },
]

const FALLBACK_GROUP = { key: 'more', label: 'More' } as const

const PATH: Record<NavKind, string> = {
  collection: '/collections',
  global: '/globals',
  view: '',
}

const keyOf = (kind: NavKind, slug: string) => `${kind}:${slug}`

export const navHref = (kind: NavKind, slug: string): string => `${PATH[kind]}/${slug}`

/** Collection slug → the count shown on its sidebar row. */
export type NavBadges = Partial<Record<string, number>>

/**
 * Groups the entities the signed-in user may open, in the sidebar's fixed order. `entities` must
 * already be filtered by visibility and read permission (AdminNav does that). Anything not listed
 * in the layout (a collection added later) still shows, under "More", so nothing silently vanishes.
 * `view` entries (Website manager) show when `websiteManager` is true.
 */
export function buildNavGroups({
  entities,
  badges = {},
  websiteManager = true,
}: {
  entities: NavEntity[]
  badges?: NavBadges
  websiteManager?: boolean
}): NavGroupData[] {
  const bySlug = new Map(entities.map((e) => [keyOf(e.kind, e.slug), e]))
  const used = new Set<string>()

  const toItem = (entry: LayoutEntry): NavItemData | null => {
    const key = keyOf(entry.kind, entry.slug)
    if (entry.kind === 'view') {
      if (!websiteManager) return null
      used.add(key)
      return {
        key,
        slug: entry.slug,
        kind: entry.kind,
        href: navHref(entry.kind, entry.slug),
        label: entry.label ?? entry.slug,
      }
    }
    const entity = bySlug.get(key)
    if (!entity) return null
    used.add(key)
    const badge = entry.kind === 'collection' ? badges[entry.slug] : undefined
    return {
      key,
      slug: entry.slug,
      kind: entry.kind,
      href: navHref(entry.kind, entry.slug),
      label: entry.label ?? entity.label,
      ...(badge && badge > 0 ? { badge } : {}),
    }
  }

  const groups: NavGroupData[] = LAYOUT.map((group) => ({
    key: group.key,
    label: group.label,
    ...(group.tucked ? { tucked: true } : {}),
    items: group.items.map(toItem).filter((item): item is NavItemData => item !== null),
  }))

  const extra: NavItemData[] = entities
    .filter((e) => !used.has(keyOf(e.kind, e.slug)))
    .map((e) => ({
      key: keyOf(e.kind, e.slug),
      slug: e.slug,
      kind: e.kind,
      href: navHref(e.kind, e.slug),
      label: e.label,
    }))
  if (extra.length) groups.push({ ...FALLBACK_GROUP, items: extra })

  // The tucked group goes last, after "More".
  const shown = groups.filter((g) => g.items.length > 0)
  return [...shown.filter((g) => !g.tucked), ...shown.filter((g) => g.tucked)]
}
