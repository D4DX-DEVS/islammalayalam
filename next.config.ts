import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { PREVIEW_COOKIE } from './src/lib/preview'
import { cdnUrl } from './src/lib/spaces'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const isProd = process.env.NODE_ENV === 'production'

function cdnPattern(): { protocol: 'https'; hostname: string; pathname: string }[] {
  const cdn = cdnUrl(process.env.DO_SPACES_CDN_ENDPOINT)
  return cdn ? [{ protocol: 'https', hostname: new URL(cdn).hostname, pathname: '/**' }] : []
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
  // WordPress URLs end in "/" (/1234/, /category/news/). Next would 308 them to no-slash; instead
  // src/proxy.ts adds the slash for public pages only (API/admin paths are left untouched).
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/brand/**' }],
    remotePatterns: [
      ...cdnPattern(),
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
    ],
    formats: ['image/avif', 'image/webp'],
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
