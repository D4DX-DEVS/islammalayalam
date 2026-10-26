/**
 * PWA helpers shared by the service worker route (/sw.js) and the client (install banner, update
 * toast, hide-on-scroll bars). Pure functions, so they are unit-tested without a browser.
 */

/** Changes on every deploy (next.config.ts bakes it in): a new /sw.js byte-for-byte = an update. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

export const SW_PATH = '/sw.js'
/** Message the update toast posts to the waiting worker. */
export const SKIP_WAITING = 'SKIP_WAITING'
/** Window event the mobile dock fires to open the MobileNav drawer. */
export const OPEN_MOBILE_NAV = 'mobile-nav:open'

export const INSTALL_DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DAYS = 14

/** The install banner stays hidden for two weeks after "Not now". */
export function installDismissed(storedAt: string | null, now: number): boolean {
  const at = Number(storedAt)
  if (!storedAt || !Number.isFinite(at)) return false
  return now - at < DISMISS_DAYS * 86_400_000
}

/** iPhone/iPad Safari: no `beforeinstallprompt`, installing is Share → Add to Home Screen. */
export function isIosSafari(ua: string, maxTouchPoints = 0): boolean {
  const ios = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export type ScrollDir = 'up' | 'down'

/**
 * Facebook-style bars: hide after scrolling down, show again on any real scroll up, and always
 * near the top. Jitter under `threshold` px keeps the previous state.
 */
export function nextScrollDir(
  prev: ScrollDir,
  lastY: number,
  y: number,
  { top = 80, threshold = 8 } = {},
): ScrollDir {
  if (y <= top) return 'up'
  const delta = y - lastY
  if (Math.abs(delta) < threshold) return prev
  return delta > 0 ? 'down' : 'up'
}

/** Requests the worker never touches: admin, API, previews, Next internals other than static. */
export const SW_BYPASS = ['/admin', '/api/', '/next/', SW_PATH, '/_next/data/', '/_next/image']
/** Immutable or rarely-changing files served cache-first. */
export const SW_CACHE_FIRST = ['/_next/static/', '/brand/', '/pdfjs/']

const startsWithAny = (pathname: string, prefixes: string[]): boolean =>
  prefixes.some((p) => pathname.startsWith(p))

export const swBypass = (pathname: string): boolean => startsWithAny(pathname, SW_BYPASS)
export const swCacheFirst = (pathname: string): boolean => startsWithAny(pathname, SW_CACHE_FIRST)

/**
 * The worker script. Network-first pages (fresh content online, last copy offline), cache-first
 * static assets, nothing else intercepted. A new version installs and then waits: the page shows
 * the "Update" toast, which posts SKIP_WAITING; the page reloads once the new worker takes over.
 */
export function serviceWorkerSource(version: string): string {
  return `/* Islam Malayalam service worker — ${version} */
const VERSION = ${JSON.stringify(version)};
const ASSETS = 'im-assets-' + VERSION;
const PAGES = 'im-pages';
const MAX_PAGES = 40;
const BYPASS = ${JSON.stringify(SW_BYPASS)};
const CACHE_FIRST = ${JSON.stringify(SW_CACHE_FIRST)};
const bypass = (p) => BYPASS.some((x) => p.startsWith(x));
const cacheFirst = (p) => CACHE_FIRST.some((x) => p.startsWith(x));
const OFFLINE = '<!doctype html><html lang="ml"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px;color:#0a4398"><div><img src="/brand/icon-192.png" width="72" height="72" alt=""><h1 style="font-size:1.25rem">You are offline</h1><p style="color:#475569">Check your connection and try again.</p><button onclick="location.reload()" style="border:0;border-radius:999px;background:#1a6bc4;color:#fff;padding:10px 22px;font-size:1rem">Retry</button></div></body></html>';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSETS).then((c) => c.addAll(['/brand/icon-192.png'])).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('im-assets-') && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === ${JSON.stringify(SKIP_WAITING)}) self.skipWaiting();
  if (event.data === 'VERSION' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map((k) => cache.delete(k)));
}

async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected && res.type === 'basic') {
      cache.put(request, res.clone()).then(() => trim(cache));
    }
    return res;
  } catch {
    return (await cache.match(request)) ||
      new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || bypass(url.pathname)) return;
  if (request.mode === 'navigate') return event.respondWith(page(request));
  if (cacheFirst(url.pathname)) return event.respondWith(asset(request));
});
`
}
