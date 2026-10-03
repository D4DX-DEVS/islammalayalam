/**
 * Upload file policy (audit: only jpeg/png/gif/webp/pdf are ever accepted; SVG, fonts, CSS, archives,
 * scripts and unknown types are rejected). The declared MIME type and extension are NOT trusted —
 * the file's own magic bytes decide.
 */
export type AllowedKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf'

export const KIND_INFO: Record<AllowedKind, { mime: string; ext: string; image: boolean }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', image: true },
  png: { mime: 'image/png', ext: 'png', image: true },
  gif: { mime: 'image/gif', ext: 'gif', image: true },
  webp: { mime: 'image/webp', ext: 'webp', image: true },
  pdf: { mime: 'application/pdf', ext: 'pdf', image: false },
}

export const ALLOWED_MIME_TYPES = Object.values(KIND_INFO).map((k) => k.mime)
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_PDF_BYTES = 40 * 1024 * 1024

const EXT_ALIASES: Record<string, AllowedKind> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
  pdf: 'pdf',
}

/** Identify a file by its leading bytes. Returns null for anything outside the allowlist. */
export function sniffKind(buf: Uint8Array): AllowedKind | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a
  )
    return 'png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif'
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return 'webp'
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d)
    return 'pdf'
  return null
}

export function kindFromFilename(name: string): AllowedKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  return ext ? (EXT_ALIASES[ext] ?? null) : null
}

export type PolicyResult = { ok: true; kind: AllowedKind } | { ok: false; reason: string }

/** Magic bytes must be allowlisted AND agree with the extension; size limits per kind. */
export function checkFilePolicy(buf: Uint8Array, filename: string): PolicyResult {
  const kind = sniffKind(buf)
  if (!kind) return { ok: false, reason: 'file type not allowed (only JPEG, PNG, GIF, WebP, PDF)' }
  const extKind = kindFromFilename(filename)
  if (!extKind) return { ok: false, reason: 'file extension not allowed' }
  if (extKind !== kind)
    return {
      ok: false,
      reason: `extension .${filename.split('.').pop()} does not match file content (${kind})`,
    }
  const limit = KIND_INFO[kind].image ? MAX_IMAGE_BYTES : MAX_PDF_BYTES
  if (buf.length > limit)
    return {
      ok: false,
      reason: `file too large (${Math.round(buf.length / 1048576)} MB > ${limit / 1048576} MB)`,
    }
  return { ok: true, kind }
}

/** Filesystem/URL-safe name: ASCII slug of the base name + canonical extension. */
export function safeFilename(name: string, kind: AllowedKind): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file'
  return `${slug}.${KIND_INFO[kind].ext}`
}
