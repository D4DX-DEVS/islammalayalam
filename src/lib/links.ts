import type { Category, Page, Post } from '@/payload-types'
import { isSafeHref } from '@/lib/security/url'

/** Shape of the `linkGroup` field (menus, footer, homepage blocks). */
export type CmsLink = {
  type?: ('reference' | 'custom' | 'none') | null
  newTab?: boolean | null
  label?: string | null
  url?: string | null
  reference?:
    | { relationTo: 'pages'; value: string | Page }
    | { relationTo: 'posts'; value: string | Post }
    | { relationTo: 'categories'; value: string | Category }
    | null
}

export type ResolvedLink = {
  label: string
  href: string | null
  newTab: boolean
  external: boolean
}

export const postHref = (postNumber: number | null | undefined): string | null =>
  postNumber ? `/${postNumber}/` : null
export const pageHref = (path: string | null | undefined): string | null =>
  path ? `/${path}/` : null
export const categoryHref = (slug: string | null | undefined): string | null =>
  slug ? `/category/${slug}/` : null

/** Resolve a CMS link to an href. Unpopulated references and unsafe URLs resolve to label-only. */
export function resolveLink(link: CmsLink | null | undefined): ResolvedLink | null {
  if (!link?.label) return null
  const base = { label: link.label, newTab: Boolean(link.newTab), external: false }
  if (link.type === 'custom') {
    const url = link.url ?? ''
    if (!isSafeHref(url)) return { ...base, href: null }
    return { ...base, href: url, external: /^https?:\/\//.test(url) }
  }
  if (link.type === 'reference' && link.reference && typeof link.reference.value === 'object') {
    const { relationTo, value } = link.reference
    if (relationTo === 'pages') return { ...base, href: pageHref((value as Page).path) }
    if (relationTo === 'posts') return { ...base, href: postHref((value as Post).postNumber) }
    return { ...base, href: categoryHref((value as Category).slug) }
  }
  return { ...base, href: null }
}
