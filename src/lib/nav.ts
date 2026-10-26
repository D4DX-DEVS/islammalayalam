import { resolveLink } from '@/lib/links'
import type { CmsLink } from '@/lib/links'

/** Serializable menu tree handed to both the desktop (server) and mobile (client) navigation. */
export type NavItem = {
  id: string
  label: string
  href: string | null
  newTab: boolean
  external: boolean
  /** Header links only: render as a highlighted button (Postal Library, Order the Quran…). */
  highlight: boolean
  children: NavItem[]
}
/** A titled list of links (a footer "Quick Links" column), shown as its own group in the mobile menu. */
export type NavGroup = { id: string; title: string; links: NavItem[] }

type MenuNode = {
  id?: string | null
  link: CmsLink
  highlight?: boolean | null
  children?: MenuNode[] | null
}

export function toNavTree(nodes: MenuNode[] | null | undefined, prefix = 'n'): NavItem[] {
  return (nodes ?? []).flatMap((node, i) => {
    const link = resolveLink(node.link)
    if (!link) return []
    const id = `${prefix}-${node.id ?? i}`
    return [
      { id, ...link, highlight: Boolean(node.highlight), children: toNavTree(node.children, id) },
    ]
  })
}

/** The footer's link columns as menu groups; columns with no usable link are left out. */
export function toNavGroups(
  columns: { id?: string | null; kind: string; title: string; links?: MenuNode[] | null }[] | null | undefined,
): NavGroup[] {
  return (columns ?? []).flatMap((column, i) => {
    if (column.kind !== 'links') return []
    const id = `group-${column.id ?? i}`
    const links = toNavTree(column.links, id)
    return links.length ? [{ id, title: column.title, links }] : []
  })
}

/** True when `pathname` is the item's page or inside its subtree (for aria-current / highlight). */
export function isActive(item: NavItem, pathname: string): boolean {
  const decoded = safeDecode(pathname)
  if (item.href && !item.external) {
    const href = safeDecode(item.href)
    if (href === '/' ? decoded === '/' : decoded === href || decoded.startsWith(href)) return true
  }
  return item.children.some((child) => isActive(child, pathname))
}

/** Exact-page match (for aria-current), comparing decoded, NFC paths. */
export function isCurrent(item: NavItem, pathname: string): boolean {
  return Boolean(item.href && !item.external && safeDecode(item.href) === safeDecode(pathname))
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).normalize('NFC')
  } catch {
    return value
  }
}
