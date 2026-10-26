import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildCsp, createNonce, originOf } from '@/lib/security/csp'
import { PREVIEW_COOKIE, PREVIEW_ROUTE } from '@/lib/preview'
import { isAdminPath, needsTrailingSlash } from '@/lib/routing'
import { cdnUrl } from '@/lib/spaces'

/**
 * Per-request Content-Security-Policy with a fresh nonce (audit §13: the legacy site was
 * compromised through injected <script>; a nonce CSP means injected markup cannot execute even
 * if it ever reached a page). Separate policies for the public site and the Payload admin.
 * Also forwards the pathname for payload-totp (x-pathname), always overwriting client input.
 */
const MEDIA_ORIGIN = originOf(cdnUrl(process.env.DO_SPACES_CDN_ENDPOINT))
const MODE = {
  dev: process.env.NODE_ENV === 'development',
  prod: process.env.NODE_ENV === 'production',
  mediaOrigin: MEDIA_ORIGIN,
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  // Payload's open sign-up form for an empty DB. Never served: the first admin is created with
  // `npm run create-admin` (first-register is also refused by blockRemoteFirstUser).
  if (/^\/admin\/create-first-user\/?$/.test(pathname))
    return new NextResponse(
      'Admin is not set up yet. On the server, set ADMIN_EMAIL / ADMIN_PASSWORD in .env and run `npm run create-admin`, then open /admin to log in.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
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
  // The preview entry route is framed by the admin before that cookie exists (see next.config.ts).
  const previewEntry = pathname === PREVIEW_ROUTE || pathname === PREVIEW_ROUTE.slice(0, -1)
  const csp = buildCsp(n, isAdminPath(pathname) ? 'admin' : 'site', MODE, {
    previewFrame: preview || previewEntry,
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

// pdfjs/: the e-book reader's worker and data files (static, ours). A CSP on the worker's own
// response would govern the worker itself, and the nonce policy cannot cover a worker's wasm decoders.
export const config = {
  matcher: [
    {
      source: '/((?!api/|_next/static|_next/image|pdfjs/|favicon.ico|robots.txt|sitemap).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
