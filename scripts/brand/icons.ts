/**
 * `npx tsx scripts/brand/icons.ts` — every app icon, derived from public/brand/icon-512.png (the
 * clean, redrawn site mark written by import-logo.ts). Local files only; nothing is downloaded.
 * Outputs: public/brand/{icon-192,apple-touch-icon,icon-maskable-512}.png, src/app/favicon.ico and
 * the admin app's own set, public/brand/admin-{192,512,maskable-512,apple-touch}.png: the mark on a
 * white disc on the admin's navy, so the two installed apps never look alike on a home screen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = join('public', 'brand')
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

const mark = readFileSync(join(OUT, 'icon-512.png'))

/** A `size` px square with the mark filling `scale` of it, centred on `background`. */
async function icon(size: number, scale = 1, background = CLEAR): Promise<Buffer> {
  const inner = Math.round(size * scale)
  const art = await sharp(mark)
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .png()
    .toBuffer()
  const offset = Math.floor((size - inner) / 2)
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const NAVY = '#0f1b2e' // --im-nav in app/(payload)/custom.scss

/**
 * Admin app icon: a navy `size` px tile (corners rounded by `radius` of it; 0 when the platform
 * masks it) holding a white disc `disc` of the width, with the mark at 72 % of the disc.
 */
async function adminIcon(size: number, { radius = 0, disc = 0.8 } = {}): Promise<Buffer> {
  const r = Math.round(size * radius)
  const d = size * disc
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${d / 2}" fill="#fff"/></svg>`,
  )
  const inner = Math.round(d * 0.72)
  const art = await sharp(mark)
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .png()
    .toBuffer()
  const offset = Math.floor((size - inner) / 2)
  return sharp(tile)
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** Windows/.ico container holding PNG images (supported by every current browser). */
function ico(images: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

writeFileSync(join(OUT, 'icon-192.png'), await icon(192))
// iOS shows it on an opaque tile with rounded corners: keep the star's tips clear of them.
writeFileSync(join(OUT, 'apple-touch-icon.png'), await icon(180, 0.84, WHITE))
// Android crops maskable icons to a shape inside the central 80 % circle.
writeFileSync(join(OUT, 'icon-maskable-512.png'), await icon(512, 0.72, WHITE))
writeFileSync(
  join('src', 'app', 'favicon.ico'),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await icon(size) })))),
)
// Admin: rounded tiles where the platform shows icons as-is; full-bleed where it masks them (the
// disc stays inside Android's 80 % safe circle; iOS rounds the corners itself).
writeFileSync(join(OUT, 'admin-192.png'), await adminIcon(192, { radius: 0.22 }))
writeFileSync(join(OUT, 'admin-512.png'), await adminIcon(512, { radius: 0.22 }))
writeFileSync(join(OUT, 'admin-maskable-512.png'), await adminIcon(512, { disc: 0.74 }))
writeFileSync(join(OUT, 'admin-apple-touch.png'), await adminIcon(180, { disc: 0.82 }))
process.stdout.write(
  'icons: icon-192, apple-touch-icon, icon-maskable-512, favicon.ico, admin-{192,512,maskable-512,apple-touch}\n',
)
