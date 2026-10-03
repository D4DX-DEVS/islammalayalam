import { resolveLink } from '@/lib/links'
import type { CmsLink } from '@/lib/links'

/** Serializable menu tree handed to both the desktop (server) and mobile (client) navigation. */
export type NavItem = {
  id: string
  label: string
  href: string | null
  newTab: boolean
  external: boolean
  children: NavItem[]
}
type MenuNode = { id?: string | null; link: CmsLink; children?: MenuNode[] | null }

export function toNavTree(nodes: MenuNode[] | null | undefined, prefix = 'n'): NavItem[] {
  return (nodes ?? []).flatMap((node, i) => {
    const link = resolveLink(node.link)
    if (!link) return []
    const id = `${prefix}-${node.id ?? i}`
    return [{ id, ...link, children: toNavTree(node.children, id) }]
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
