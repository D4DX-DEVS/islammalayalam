/**
 * `npx tsx scripts/brand/import-logo.ts` — one-time import of the site's real logo and icon from
 * the old WordPress uploads (2018/11), through the same protection as migrated media (Gate B):
 * this site's own /wp-content/uploads/ only, no redirects, size-capped, kept in memory, file type
 * checked by its bytes, then DRAWN AGAIN into brand-new PNG files. Only the redrawn files are
 * written. Outputs: public/brand/{logo,logo-mobile,icon-512}.png; icons.ts then derives the other
 * icons and src/app/favicon.ico from icon-512.png.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { sniffKind } from '@/lib/media/file-policy'
import { download } from '../../migration/load/media'

const UPLOADS = 'https://islammalayalam.net/wp-content/uploads/2018/11'
const OUT = join('public', 'brand')

/** Download → check → redraw (decode pixels, write a new PNG; nothing else survives). */
async function cleanPng(file: string): Promise<Buffer> {
  const bytes = await download(`${UPLOADS}/${file}`)
  if (sniffKind(bytes) !== 'png') throw new Error(`${file}: not a PNG`)
  const { data, info } = await sharp(bytes, { failOn: 'error', limitInputPixels: 4_000_000 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

mkdirSync(OUT, { recursive: true })
const logo = await cleanPng('logo-rtn.png') // header logo, 2× (544×180)
const logoMobile = await cleanPng('logo-m-rtn.png') // compact logo, 2× (280×93)
const mark = await cleanPng('logo-512.png') // square site icon (512×512)

writeFileSync(join(OUT, 'logo.png'), logo)
writeFileSync(join(OUT, 'logo-mobile.png'), logoMobile)
writeFileSync(
  join(OUT, 'icon-512.png'),
  await sharp(mark)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer(),
)
for (const [name, buf] of Object.entries({ logo, logoMobile, mark })) {
  const m = await sharp(buf).metadata()
  process.stdout.write(`${name}: ${m.width}×${m.height}\n`)
}
await import('./icons')
