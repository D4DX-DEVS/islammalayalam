import type { MetadataRoute } from 'next'

const ADMIN = '/admin'

/**
 * The admin as its own installable app ("IM Admin"), linked from every admin page (admin.meta in
 * payload.config.ts) in place of the site's app/manifest.ts. Its own id, scope and navy icon
 * (scripts/brand/icons.ts), so staff can keep it beside the public site app on one phone.
 * The service worker never touches /admin: the admin always talks to the server.
 */
export const adminManifest: MetadataRoute.Manifest = {
  name: 'Islam Malayalam Admin',
  short_name: 'IM Admin',
  description: 'Write, publish and manage Islam Malayalam.',
  id: ADMIN,
  start_url: ADMIN,
  scope: ADMIN,
  display: 'standalone',
  background_color: '#f4f3ef',
  theme_color: '#f4f3ef',
  lang: 'en',
  dir: 'ltr',
  categories: ['productivity'],
  launch_handler: { client_mode: ['navigate-existing', 'auto'] },
  icons: [
    { src: '/brand/admin-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/brand/admin-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/brand/admin-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  // Long-press on the app icon.
  shortcuts: [
    {
      name: 'New post',
      url: `${ADMIN}/collections/posts/create`,
      icons: [{ src: '/brand/admin-192.png', sizes: '192x192', type: 'image/png' }],
    },
    {
      name: 'Posts',
      url: `${ADMIN}/collections/posts`,
      icons: [{ src: '/brand/admin-192.png', sizes: '192x192', type: 'image/png' }],
    },
    {
      name: 'Messages',
      url: `${ADMIN}/collections/contact-messages`,
      icons: [{ src: '/brand/admin-192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
}
