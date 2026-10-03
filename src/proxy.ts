import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildCsp, createNonce, originOf } from '@/lib/security/csp'
import { PREVIEW_COOKIE } from '@/lib/preview'
import { isAdminPath, needsTrailingSlash } from '@/lib/routing'

/**
 * Per-request Content-Security-Policy with a fresh nonce (audit §13: the legacy site was
 * compromised through injected <script>; a nonce CSP means injected markup cannot execute even
 * if it ever reached a page). Separate policies for the public site and the Payload admin.
 * Also forwards the pathname for payload-totp (x-pathname), always overwriting client input.
 */
const MEDIA_ORIGIN = originOf(process.env.MEDIA_CDN_URL)
const MODE = {
  dev: process.env.NODE_ENV === 'development',
  prod: process.env.NODE_ENV === 'production',
  mediaOrigin: MEDIA_ORIGIN,
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  if (needsTrailingSlash(pathname)) {
    // Plain URL on purpose: NextURL re-applies the `trailingSlash: false` formatting and would strip
    // the slash again, producing a redirect loop.
    const url = new URL(request.url)
    url.pathname = `${pathname}/`
    return NextResponse.redirect(url, 308)
  }
  // Old WordPress search links (/?s=term) → the new search page.
  if (pathname === '/' && request.nextUrl.searchParams.has('s')) {
    const url = new URL('/search/', request.url)
    url.searchParams.set('q', request.nextUrl.searchParams.get('s') ?? '')
    return NextResponse.redirect(url, 308)
  }
  const n = createNonce()
  // Draft-mode cookie present → a staff live preview: allow our own admin to frame the page and keep
  // it out of search engines. The cookie grants nothing by itself (pages re-check the admin session).
  const preview = request.cookies.has(PREVIEW_COOKIE)
  const csp = buildCsp(n, isAdminPath(pathname) ? 'admin' : 'site', MODE, {
    previewFrame: preview,
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', n)
  requestHeaders.set('x-pathname', pathname)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  // Cache-Control is Next's: every page here is dynamic → `private, no-store` in production.
  if (preview) response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
