import type { MetadataRoute } from 'next'

/** Install / home-screen metadata with the site's own emblem (public/brand). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Islam Malayalam — ഇസ്‌ലാം മലയാളം',
    short_name: 'Islam Malayalam',
    description: 'Official Website of Dialogue Centre Kerala',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a6bc4',
    lang: 'ml',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Padded on white so Android's crop never cuts the star (scripts/brand/icons.ts).
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
