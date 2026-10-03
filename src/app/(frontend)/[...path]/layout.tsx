import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { resolvePath } from '@/features/routing/resolve'

/**
 * Status codes are decided HERE, not in page.tsx: a segment's layout renders outside that segment's
 * loading.tsx Suspense boundary, so 301/404 are sent as real HTTP statuses before any skeleton
 * streams (a streamed notFound()/redirect() would be a 200 with a meta tag — bad for legacy SEO).
 */
export default async function ResolvedLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ path: string[] }>
}) {
  const res = await resolvePath((await params).path)
  if (res.kind === 'redirect') permanentRedirect(res.to)
  // 410 needs a custom status; served as a real 404 until redirects move into the proxy (Task 5).
  if (res.kind === 'not-found' || res.kind === 'gone') notFound()
  return children
}
