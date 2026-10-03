import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { getCategoryBySlug } from '@/features/categories/queries'
import { encodePath, movedTo } from '@/features/routing/resolve'
import { categoryHref } from '@/lib/links'
import { decodeSegment, normalizeSlug } from '@/lib/text/slug'

/** Existence + canonical-slug check with real 404/301 statuses (runs outside the page's loading boundary). */
export default async function CategoryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const decoded = decodeSegment((await params).slug)
  const slug = decoded ? normalizeSlug(decoded) : ''
  if (!slug) notFound()
  if (!(await getCategoryBySlug(slug))) {
    // Renamed categories and retired placements (e.g. the old "slider") live in the redirects table.
    const to = await movedTo(categoryHref(slug)!)
    if (to) permanentRedirect(to)
    notFound()
  }
  if (decoded !== slug) permanentRedirect(encodePath(categoryHref(slug)!))
  return children
}
