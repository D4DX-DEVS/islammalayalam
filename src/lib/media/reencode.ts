import sharp from 'sharp'
import type { AllowedKind } from './file-policy'

/**
 * Re-encode every uploaded image into a brand-new file:
 * pixels are decoded and written again, so anything appended/embedded in the original
 * (scripts, polyglots, EXIF/GPS, ICC tricks) is discarded. Also caps the long edge
 * (audit: four 56 MB posters) and normalises orientation.
 */
export const MAX_EDGE = 2560
const MAX_INPUT_PIXELS = 80_000_000

export type ReencodeResult = { data: Buffer; width: number; height: number }

export async function reencodeImage(
  input: Buffer,
  kind: Exclude<AllowedKind, 'pdf'>,
): Promise<ReencodeResult> {
  const animated = kind === 'gif' || kind === 'webp'
  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })

  switch (kind) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: 84, mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: 82 })
      break
    case 'gif':
      pipeline = pipeline.gif()
      break
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.pageHeight ?? info.height }
}
