import type { MetadataRoute } from 'next'

const ICON = { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }

/**
 * Install / home-screen metadata with the site's own emblem (public/brand). The admin has its own
 * app (app/admin.webmanifest/route.ts). Screenshots (public/brand/screens) feed Chrome's richer
 * install sheet; shortcuts appear on a long-press of the app icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Islam Malayalam — ഇസ്‌ലാം മലയാളം',
    short_name: 'Islam Malayalam',
    id: '/',
    scope: '/',
    description: 'Official Website of Dialogue Centre Kerala',
    start_url: '/',
    display: 'standalone',
    // An open link focuses the app window already running instead of opening a second one.
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    categories: ['education', 'books', 'lifestyle'],
    // The white header and splash (the dark theme recolours the bar at runtime: theme-color meta).
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'ml',
    dir: 'ltr',
    icons: [
      { ...ICON, purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Padded on white so Android's crop never cuts the star (scripts/brand/icons.ts).
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Insights', url: '/insights/', icons: [ICON] },
      { name: 'Audios', url: '/audios/', icons: [ICON] },
      { name: 'Search', url: '/search/', icons: [ICON] },
    ],
    screenshots: [
      {
        src: '/brand/screens/home-narrow.png',
        sizes: '780x1688',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Home page on a phone',
      },
      {
        src: '/brand/screens/home-wide.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Home page on a computer',
      },
    ],
  }
}
