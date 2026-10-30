import { CONTENT_TYPES, contentListPath } from '@/cms/content-types'

/**
 * The admin sidebar's structure as plain data (no Payload, no React), so the grouping, the order
 * and the permission rules are unit-tested. Grouped by job: Content, Library, Inbox, Website, Team,
 * with the rarely used Tools (redirects, activity log) folded away at the bottom.
 *
 * Item names come from each collection's / global's own label (set next to its config), so the
 * sidebar, the list headings and the breadcrumbs always use the same word. Only entries that are
 * not a collection or global (the Website overview) and the content kinds are named here.
 */
export type NavKind = 'collection' | 'global' | 'view'

export type NavEntity = { slug: string; kind: 'collection' | 'global'; label: string }

export type NavItemData = {
  /** Unique within the sidebar: `<kind>:<slug>` (`format:<key>` for a content kind). */
  key: string
  /** Path under the admin route, e.g. `/collections/posts`; may carry a query (a filtered list). */
  href: string
  label: string
  /** Unread / waiting count shown as a pill; absent or 0 shows nothing. */
  badge?: number
  slug: string
  kind: NavKind
  /** Other paths that light this row up. */
  also?: string[]
  /** Only this exact path lights the row up (an overview page with sub-pages of its own). */
  exact?: boolean
  /** Filtered views of this row (the content kinds under All content), shown while it is open. */
  children?: NavItemData[]
}

export type NavGroupData = {
  key: string
  label: string
  items: NavItemData[]
  /** Starts folded away behind a single row (rarely used; admins only in practice). */
  tucked?: boolean
}

type LayoutEntry = {
  kind: NavKind
  slug: string
  label?: string
  exact?: boolean
}
type LayoutGroup = { key: string; label: string; tucked?: boolean; items: LayoutEntry[] }

/** Group names also live on each config's `admin.group`; tests keep the two in step. */
export const NAV_GROUP_LABELS = {
  write: 'Content',
  library: 'Library',
  inbox: 'Inbox',
  site: 'Website',
  team: 'Team',
  advanced: 'Tools',
} as const

/**
 * The Website area: an overview page plus one page per site-wide setting, in this order (also the
 * order of the tabs SiteTabs renders on each of those pages).
 */
export const SITE_GLOBALS = [
  'homepage',
  'header',
  'footer',
  'ads-banners',
  'site-settings',
] as const

/**
 * Kept out of the sidebar on purpose (their pages still open by link): quick audio / video entries
 * (added as Video or Audio posts now) and the one-off WordPress migration records.
 */
export const NAV_OMITTED: ReadonlyArray<Pick<NavEntity, 'kind' | 'slug'>> = [
  { kind: 'collection', slug: 'audios' },
  { kind: 'collection', slug: 'videos' },
  { kind: 'collection', slug: 'migration-runs' },
  { kind: 'collection', slug: 'migration-issues' },
]

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
      { kind: 'collection', slug: 'media' },
      { kind: 'collection', slug: 'quotes' },
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
      { kind: 'view', slug: 'website', label: 'Overview', exact: true },
      ...SITE_GLOBALS.map((slug) => ({ kind: 'global' as const, slug })),
    ],
  },
  {
    key: 'team',
    label: NAV_GROUP_LABELS.team,
    // Who may sign in, and how: the two-step login switch is a sign-in rule, not part of the site.
    items: [
      { kind: 'collection', slug: 'users' },
      { kind: 'global', slug: 'security-settings' },
    ],
  },
  {
    // Technical lists an everyday editor never needs: folded behind one row.
    key: 'advanced',
    label: NAV_GROUP_LABELS.advanced,
    tucked: true,
    items: [
      { kind: 'collection', slug: 'redirects' },
      { kind: 'collection', slug: 'audit-logs' },
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

/** The content kinds as filtered views of the Posts list, in the order of src/cms/content-types.ts. */
export const contentKindItems = (): NavItemData[] =>
  CONTENT_TYPES.map((type) => ({
    key: `format:${type.key}`,
    slug: 'posts',
    kind: 'collection',
    href: contentListPath(type.key),
    label: type.plural,
  }))

/** Collection slug → the count shown on its sidebar row. */
export type NavBadges = Partial<Record<string, number>>

/**
 * Groups the entities the signed-in user may open, in the sidebar's fixed order. `entities` must
 * already be filtered by visibility and read permission (AdminNav does that). Anything not listed
 * in the layout (a collection added later) still shows, under "More", so nothing silently vanishes.
 * The Website overview (`view`) shows when `websiteManager` is true.
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
  // Omitted entities never fall through to "More".
  const used = new Set<string>(NAV_OMITTED.map((e) => keyOf(e.kind, e.slug)))

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
        ...(entry.exact ? { exact: true } : {}),
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
      ...(entry.slug === 'posts' ? { children: contentKindItems() } : {}),
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
