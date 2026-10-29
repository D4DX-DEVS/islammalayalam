import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { PREVIEW_COOKIE } from './src/lib/preview'
import { cdnUrlFrom } from './src/lib/spaces'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const isProd = process.env.NODE_ENV === 'production'

/** The media CDN for next/image. Baked in at build time; a production build always allows the real CDN. */
function cdnPattern(): { protocol: 'https'; hostname: string; pathname: string }[] {
  const cdn = cdnUrlFrom(process.env.DO_SPACES_CDN_ENDPOINT, process.env.NODE_ENV)
  return cdn ? [{ protocol: 'https', hostname: new URL(cdn).hostname, pathname: '/**' }] : []
}

/**
 * Deploy version for the PWA: /sw.js embeds it, so each deploy is a new worker and installed apps
 * get the "Update" toast. App Platform's commit SHA, else local git, else the build time.
 */
function appVersion(): string {
  const sha = process.env.COMMIT_SHA || process.env.SOURCE_COMMIT
  if (sha) return sha.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return String(Date.now())
  }
}

/** Static security headers for every response (the per-request CSP is set in src/proxy.ts). */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()',
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: `${appVersion()}-${Date.now().toString(36)}` },
  // Keep the dev-only Next badge clear of the admin sidebar's account card (bottom-left).
  devIndicators: { position: 'bottom-right' },
  // WordPress URLs end in "/" (/1234/, /category/news/). Next would 308 them to no-slash; instead
  // src/proxy.ts adds the slash for public pages only (API/admin paths are left untouched).
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  images: {
    // 75 is the default; banners (ads, the top banner) ask for 90 so text and QR codes stay crisp.
    qualities: [75, 90],
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/brand/**' }],
    remotePatterns: [
      ...cdnPattern(),
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
      // Cover art of Spotify episodes (the Audios section).
      { protocol: 'https', hostname: 'i.scdn.co', pathname: '/image/**' },
      { protocol: 'https', hostname: '**.spotifycdn.com', pathname: '/image/**' },
      // Insights from the site's Instagram account (features/instagram).
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
    ],
    // WebP only: AVIF encoding took 1–3.5 s per image on the App Platform instance (and timed out
    // under load). Uploads are already WebP, so WebP resizes are fast and nearly as small.
    formats: ['image/webp'],
    // Optimized copies are keyed by URL and uploads never change in place: cache them for 31 days.
    minimumCacheTTL: 2678400,
    // Drop the 2048/3840 widths: no layout is wider than 1920 px, and each width is another encode.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Framing: never, except a staff live preview (draft-mode cookie) inside our own admin. The
      // matching CSP frame-ancestors is set per request in src/proxy.ts.
      {
        source: '/:path*',
        missing: [{ type: 'cookie', key: PREVIEW_COOKIE }],
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        source: '/:path*',
        has: [{ type: 'cookie', key: PREVIEW_COOKIE }],
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      // The preview entry itself (redirect or a plain-text "sign in first" message) is framed by our
      // own admin before the draft cookie exists; without this the pane only says "content is blocked".
      { source: '/next/preview', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      { source: '/next/preview/', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      // Later rules win for the same header: the admin is never frameable, cookie or not.
      { source: '/admin/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      // JSON API and uploaded files: nothing in these responses may ever execute as a document.
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
          },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
