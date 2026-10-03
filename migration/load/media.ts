import { APIError } from 'payload'
import { checkFilePolicy, KIND_INFO, MAX_IMAGE_BYTES, sniffKind } from '@/lib/media/file-policy'
import { reencodeImage } from '@/lib/media/reencode'
import type { WpMedia } from '../lib/snapshot'
import { hashOf, type Run } from '../lib/run'
import { htmlToText } from '../lib/text'
import { OWN_HOSTS } from '../lib/exclusions'
import { originalUploadUrl } from '../transform/links'

/**
 * Gate B — files. Every file the migrated content references is fetched from the site's own
 * /wp-content/uploads/ ONLY (no other host, no redirect to another host), kept in memory, checked
 * by magic bytes against the allowlist, and handed to Payload, whose media guard re-encodes images
 * into brand-new files and scans PDFs. The original bytes are never written to disk. Anything that
 * fails is quarantined (listed in the report), never stored.
 */
export type MigratedMedia = { id: string; url: string; kind: string }
const SITE = 'https://islammalayalam.net'
const MAX_DOWNLOAD = 80 * 1024 * 1024
const TIMEOUT_MS = 180_000

export class MediaMigrator {
  private readonly byKey = new Map<string, WpMedia>()
  private readonly byWpId = new Map<number, WpMedia>()
  private readonly done = new Map<string, Promise<MigratedMedia | null>>()
  /** Stored one at a time: Payload picks unique file names check-then-write, so parallel creates could collide. */
  private writes: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly run: Run,
    library: WpMedia[],
  ) {
    for (const m of library) {
      this.byWpId.set(m.id, m)
      for (const u of m.variantUrls) {
        const key = keyOf(u)
        if (key && !this.byKey.has(key)) this.byKey.set(key, m)
      }
    }
  }

  /** Library item for a WordPress attachment id (featured images). */
  libraryItem(wpId: number): WpMedia | undefined {
    return this.byWpId.get(wpId)
  }

  /** The migrated file for a URL/attachment, migrating it on first use. Null when not migratable. */
  ensure(urlOrItem: string | WpMedia, forWpId?: number): Promise<MigratedMedia | null> {
    const item = typeof urlOrItem === 'string' ? undefined : urlOrItem
    const key = item ? keyOf(item.source_url) : keyOf(urlOrItem as string)
    if (!key) return Promise.resolve(null)
    let pending = this.done.get(key)
    if (!pending) {
      pending = this.migrate(key, item ?? this.byKey.get(key), forWpId)
      this.done.set(key, pending)
    }
    return pending
  }

  /** Already-migrated result for a URL (synchronous lookup after `ensure` finished). */
  async lookup(url: string): Promise<MigratedMedia | null> {
    const key = keyOf(url)
    return key ? ((await this.done.get(key)) ?? null) : null
  }

  private async migrate(
    key: string,
    item: WpMedia | undefined,
    forWpId?: number,
  ): Promise<MigratedMedia | null> {
    const { payload } = this.run
    this.run.tally('media', 'source')
    const existing = await payload.find({
      collection: 'media',
      where: item
        ? { or: [{ 'legacy.wpId': { equals: item.id } }, { 'legacy.legacyUrls': { equals: key } }] }
        : { 'legacy.legacyUrls': { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    })
    const found = existing.docs[0] as { id: string; url?: string; mimeType?: string } | undefined
    if (found) {
      this.run.tally('media', 'unchanged')
      return { id: String(found.id), url: found.url ?? '', kind: found.mimeType ?? '' }
    }

    const source = item?.source_url ?? key
    const ref = item ? { wpId: item.id } : { wpId: forWpId }
    const fail = (severity: 'quarantined' | 'rejected', why: string) => {
      this.run.issue({
        entity: 'media',
        wpId: ref.wpId,
        gate: 'B-media',
        severity,
        summary: `${why}: ${reportPath(source)}`,
      })
      return null
    }
    if (!isOwnUpload(source)) return fail('rejected', 'not an upload of this site')
    const filename = safeDecode(pathOf(source).split('/').pop() ?? 'file')
    if (!/\.(jpe?g|png|gif|webp|pdf)$/i.test(filename))
      return fail('rejected', 'file type not migrated')
    if (this.run.dryRun) return { id: `dry-run:${key}`, url: '', kind: 'unknown' }

    let bytes: Buffer
    try {
      bytes = await download(source)
    } catch (err) {
      return fail('quarantined', `download failed (${downloadFailure(err)})`)
    }
    const kind = sniffKind(bytes)
    if (!kind) return fail('quarantined', 'content is not an allowed file type')
    if (kind !== 'pdf' && KIND_INFO[kind].image && bytes.length > MAX_IMAGE_BYTES) {
      // Oversized originals (audit: 56 MB posters) are shrunk in memory by the same re-encoder the
      // media guard uses; the guard then re-encodes the result once more.
      try {
        bytes = (await reencodeImage(bytes, kind)).data
      } catch {
        return fail('quarantined', 'image could not be decoded')
      }
    }
    const policy = checkFilePolicy(bytes, filename)
    if (!policy.ok) return fail('quarantined', policy.reason)

    const alt = htmlToText(item?.alt_text ?? '').slice(0, 300)
    const caption = htmlToText(item?.caption ?? '').slice(0, 300)
    const legacyUrls = [
      ...new Set([key, ...(item?.variantUrls ?? []).map(keyOf).filter((k): k is string => !!k)]),
    ]
    try {
      const doc = (await this.serial(() =>
        payload.create({
          collection: 'media',
          data: {
            alt,
            caption: caption || undefined,
            legacy: {
              wpId: item?.id,
              legacyUrls,
              sourceHash: hashOf({ key, size: bytes.length }),
              migratedAt: new Date().toISOString(),
            },
          },
          file: {
            data: bytes,
            mimetype: KIND_INFO[policy.kind].mime,
            name: filename,
            size: bytes.length,
          },
          overrideAccess: true,
          context: this.run.context,
        }),
      )) as { id: string; url?: string; mimeType?: string }
      this.run.tally('media', 'created')
      if (!alt && KIND_INFO[policy.kind].image)
        this.run.issue({
          entity: 'media',
          wpId: item?.id,
          gate: 'C-content',
          severity: 'warning',
          summary: `image has no alt text: ${reportPath(source)}`,
        })
      return { id: String(doc.id), url: doc.url ?? '', kind: doc.mimeType ?? '' }
    } catch (err) {
      const message = err instanceof APIError ? reportText(err.message) : 'stored file was refused'
      return fail('quarantined', message)
    }
  }

  private serial<T>(write: () => Promise<T>): Promise<T> {
    const next = this.writes.then(write, write)
    this.writes = next.catch(() => undefined)
    return next
  }
}

/** Matching key for any URL that points at this site's uploads (null for other hosts). */
export function keyOf(url: string): string | null {
  try {
    const u = new URL(url, SITE)
    if (!OWN_HOSTS.has(u.hostname.toLowerCase())) return null
    if (!u.pathname.startsWith('/wp-content/uploads/')) return null
    return originalUploadUrl(u)
  } catch {
    return null
  }
}

function isOwnUpload(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      OWN_HOSTS.has(u.hostname.toLowerCase()) &&
      u.pathname.startsWith('/wp-content/uploads/')
    )
  } catch {
    return false
  }
}

const pathOf = (url: string): string => {
  try {
    return new URL(url, SITE).pathname
  } catch {
    return url.slice(0, 200)
  }
}

/**
 * Fetch one upload into memory. Always https to the canonical host; redirects are not followed
 * (a redirect to anywhere else is refused); size is capped while streaming.
 */
export async function download(url: string): Promise<Buffer> {
  if (!isOwnUpload(url)) throw new DownloadError('not an upload of this site')
  const u = new URL(url)
  u.protocol = 'https:'
  u.hostname = 'islammalayalam.net'
  u.port = ''
  u.username = ''
  u.password = ''
  const res = await fetch(u, {
    redirect: 'manual',
    headers: {
      accept: 'image/*,application/pdf;q=0.9',
      'user-agent': 'IslamMalayalam-migration/1.0',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (res.status !== 200) throw new DownloadError(`HTTP ${res.status}`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_DOWNLOAD) throw new DownloadError('too large')
  if (!res.body) throw new DownloadError('empty body')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length
    if (size > MAX_DOWNLOAD) throw new DownloadError('too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** Download failures with fixed wording (safe to put in reports). */
class DownloadError extends Error {}

function downloadFailure(err: unknown): string {
  if (err instanceof DownloadError) return err.message
  return err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network error'
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Upload path as it may appear in a report: URL-encoded, plain characters only, shortened. File
 * names come from the compromised site, so they are never shown as free text.
 */
function reportPath(url: string): string {
  return pathOf(url)
    .replace(/[^A-Za-z0-9._~%/-]/g, '_')
    .slice(0, 140)
}

/** Messages from the CMS: printable ASCII only, shortened. */
const reportText = (text: string): string => text.replace(/[^\x20-\x7E]/g, '?').slice(0, 160)
