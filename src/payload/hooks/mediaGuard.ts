import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { APIError } from 'payload'
import type { CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'
import { checkFilePolicy, KIND_INFO, safeFilename } from '@/lib/media/file-policy'
import { reencodeImage } from '@/lib/media/reencode'
import { scanPdf } from '@/lib/media/pdf-scan'

/**
 * Media guard (audit Gate B, applied to every upload — editor or migration):
 *  1. magic bytes must be an allowlisted type and match the extension (declared MIME is ignored)
 *  2. images are decoded and re-encoded into a brand-new file (payloads/EXIF discarded, long edge capped)
 *  3. PDFs are statically scanned (incl. compressed streams) and rejected if they can run code
 *  4. filenames are replaced by an ASCII-safe name
 * Runs in beforeOperation, i.e. before Payload stores the file or generates image sizes.
 */
// Per-operation verdict: cleared at the start of every media create/update, set only by a guarded upload.
type Stash = { sourceSha256: string; kind: string; blurDataURL?: string; reencoded: boolean }
const STASH_KEY = 'mediaGuard'

export const guardMediaUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return
  delete req.context[STASH_KEY] // a verdict never outlives its own operation (req may be reused)
  if (!req.file) {
    // A create with `{ url, filename }` makes Payload fetch the file itself AFTER this hook — the
    // bytes would never pass the guard. Payload strips `url` from args.data before hooks run, so
    // the raw request body (req.data, REST/admin) is checked too. `rejectFilelessCreate` below is
    // the backstop for any other path.
    const bodies = [
      (args as { data?: Record<string, unknown> }).data,
      req.data as Record<string, unknown> | undefined,
    ]
    if (operation === 'create' && bodies.some((b) => typeof b?.url === 'string' && b.url !== '')) {
      throw new APIError('Upload rejected: remote URL uploads are disabled', 400, undefined, true)
    }
    return
  }
  const file = req.file
  const original =
    file.tempFilePath && !file.data?.length
      ? await readFile(file.tempFilePath)
      : Buffer.from(file.data)
  const policy = checkFilePolicy(original, file.name)
  if (!policy.ok) throw new APIError(`Upload rejected: ${policy.reason}`, 400, undefined, true)

  const stash: Stash = {
    sourceSha256: createHash('sha256').update(original).digest('hex'),
    kind: policy.kind,
    reencoded: false,
  }
  const info = KIND_INFO[policy.kind]

  if (policy.kind === 'pdf') {
    const scan = scanPdf(original)
    if (!scan.ok)
      throw new APIError(
        `Upload rejected: PDF contains active content (${scan.findings.join(', ')})`,
        400,
        undefined,
        true,
      )
  } else {
    let result
    try {
      result = await reencodeImage(original, policy.kind)
    } catch {
      throw new APIError('Upload rejected: image could not be decoded', 400, undefined, true)
    }
    file.data = result.data
    file.size = result.data.length
    file.tempFilePath = undefined // Payload prefers the temp path; force it to use the re-encoded bytes
    stash.reencoded = true
    const blur = await sharp(result.data, { animated: false })
      .resize(16, 16, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer()
    stash.blurDataURL = `data:image/webp;base64,${blur.toString('base64')}`
  }
  file.mimetype = info.mime
  file.name = safeFilename(file.name, policy.kind)
  req.context[STASH_KEY] = stash
}

/**
 * Backstop: a new media document must come from bytes that went through `guardMediaUpload`.
 * Anything else (remote fetch, unknown path) is refused before Payload stores the file.
 */
export const rejectFilelessCreate: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create' && !req.context[STASH_KEY]) {
    throw new APIError(
      'Upload rejected: file bytes did not pass the media guard',
      400,
      undefined,
      true,
    )
  }
  return data
}

/** Persist the facts computed during the guard (hash of the ORIGINAL bytes for dedupe, blur placeholder). */
export const recordMediaFacts: CollectionBeforeChangeHook = ({ data, req }) => {
  const stash = req.context[STASH_KEY] as Stash | undefined
  if (!stash) return data
  delete req.context[STASH_KEY] // consumed: one verdict per upload
  return {
    ...data,
    sourceSha256: stash.sourceSha256,
    blurDataURL: stash.blurDataURL ?? data.blurDataURL ?? null,
    security: { kind: stash.kind, reencoded: stash.reencoded, scannedAt: new Date().toISOString() },
  }
}
