import { APP_VERSION, serviceWorkerRemovalSource, serviceWorkerSource } from '@/lib/pwa'

// Dynamic so Next/CDN never stamp a long s-maxage on it; the body only changes with APP_VERSION.
export const dynamic = 'force-dynamic'

/**
 * /sw.js — the PWA service worker (src/lib/pwa.ts). Never HTTP-cached, so update checks are live.
 * In development it is the self-removing worker: a caching worker would hide every code change.
 */
export function GET(): Response {
  const source =
    process.env.NODE_ENV === 'development'
      ? serviceWorkerRemovalSource()
      : serviceWorkerSource(APP_VERSION)
  return new Response(source, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  })
}
