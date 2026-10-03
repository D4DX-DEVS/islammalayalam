import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { getAuthorBySlug } from '@/features/categories/queries'
import { encodePath } from '@/features/routing/resolve'
import { decodeSegment, normalizeSlug } from '@/lib/text/slug'

/** Existence + canonical-slug check with real 404/301 statuses (runs outside the page's loading boundary). */
export default async function AuthorLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const decoded = decodeSegment((await params).slug)
  const slug = decoded ? normalizeSlug(decoded) : ''
  if (!slug || !(await getAuthorBySlug(slug))) notFound()
  if (decoded !== slug) permanentRedirect(encodePath(`/author/${slug}/`))
  return children
}
