import { APP_VERSION, serviceWorkerSource } from '@/lib/pwa'

// Dynamic so Next/CDN never stamp a long s-maxage on it; the body only changes with APP_VERSION.
export const dynamic = 'force-dynamic'

/** /sw.js — the PWA service worker (src/lib/pwa.ts). Never HTTP-cached, so update checks are live. */
export function GET(): Response {
  return new Response(serviceWorkerSource(APP_VERSION), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  })
}
