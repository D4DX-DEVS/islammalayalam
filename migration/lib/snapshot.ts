import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findIocs, sanitize, sanitizeContent } from '../../audit/lib/sanitize.mjs'

/**
 * Source: the sanitized WordPress REST snapshot written by the Phase-1 audit (audit/data/wp/*.json).
 * It was already cleaned and IOC-checked before it was written; every string is cleaned AGAIN here
 * (defence in depth — the audit sanitizer may have gained rules since), and any record that still
 * carries an indicator is returned as `rejected`, never as data.
 */
export const SNAPSHOT_DIR = join(process.cwd(), 'audit', 'data', 'wp')

type Rendered = { rendered?: string } | string | undefined
export type WpPost = {
  id: number
  date: string
  date_gmt: string
  modified_gmt: string
  slug: string
  status: string
  link: string
  title: string
  content: string
  excerpt: string
  author: number
  featured_media: number
  format: string
  categories: number[]
  tags: number[]
  sticky?: boolean
}
export type WpPage = Omit<WpPost, 'format' | 'categories' | 'tags' | 'sticky'> & {
  parent: number
  menu_order: number
  template: string
}
export type WpCategory = {
  id: number
  name: string
  slug: string
  description: string
  parent: number
  count: number
}
export type WpUser = { id: number; name: string; slug: string }
export type WpMedia = {
  id: number
  date_gmt: string
  slug: string
  title: string
  alt_text: string
  caption: string
  mime_type: string
  media_type: string
  source_url: string
  filesize?: number
  width?: number
  height?: number
  /** Every URL WordPress generated for this file (original + size variants). */
  variantUrls: string[]
  post: number | null
}
export type Rejected = { entity: string; wpId: number; iocs: string[] }
export type Snapshot = {
  posts: WpPost[]
  pages: WpPage[]
  categories: WpCategory[]
  users: WpUser[]
  media: WpMedia[]
  rejected: Rejected[]
}

const text = (v: Rendered): string => (typeof v === 'string' ? v : (v?.rendered ?? ''))

function read(name: string): Record<string, unknown>[] {
  return JSON.parse(readFileSync(join(SNAPSHOT_DIR, `${name}.json`), 'utf8'))
}

/** Clean one record's text fields; returns null (and records why) if an indicator survives. */
function clean<T extends { id: number }>(
  entity: string,
  record: T,
  richFields: Array<keyof T>,
  plainFields: Array<keyof T>,
  rejected: Rejected[],
): T | null {
  const out = { ...record }
  const iocs: string[] = []
  for (const f of richFields) {
    const r = sanitizeContent(String(out[f] ?? ''))
    iocs.push(...r.residualIocs)
    out[f] = r.clean as T[keyof T]
  }
  for (const f of plainFields) {
    const r = sanitize(String(out[f] ?? ''))
    iocs.push(...r.residualIocs)
    out[f] = r.clean as T[keyof T]
  }
  // Last check over the whole record (any field, including ones not listed above).
  iocs.push(...findIocs(JSON.stringify(out)))
  if (iocs.length) {
    rejected.push({ entity, wpId: record.id, iocs: [...new Set(iocs)] })
    return null
  }
  return out
}

const numbers = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []

export function loadSnapshot(): Snapshot {
  const rejected: Rejected[] = []
  const posts = read('posts')
    .map((r) =>
      clean<WpPost>(
        'post',
        {
          id: Number(r.id),
          date: String(r.date ?? ''),
          date_gmt: String(r.date_gmt ?? ''),
          modified_gmt: String(r.modified_gmt ?? ''),
          slug: String(r.slug ?? ''),
          status: String(r.status ?? ''),
          link: String(r.link ?? ''),
          title: text(r.title as Rendered),
          content: text(r.content as Rendered),
          excerpt: text(r.excerpt as Rendered),
          author: Number(r.author ?? 0),
          featured_media: Number(r.featured_media ?? 0),
          format: String(r.format ?? 'standard'),
          categories: numbers(r.categories),
          tags: numbers(r.tags),
          sticky: Boolean(r.sticky),
        },
        ['content', 'excerpt'],
        ['title', 'slug', 'link'],
        rejected,
      ),
    )
    .filter((p): p is WpPost => p !== null)

  const pages = read('pages')
    .map((r) =>
      clean<WpPage>(
        'page',
        {
          id: Number(r.id),
          date: String(r.date ?? ''),
          date_gmt: String(r.date_gmt ?? ''),
          modified_gmt: String(r.modified_gmt ?? ''),
          slug: String(r.slug ?? ''),
          status: String(r.status ?? ''),
          link: String(r.link ?? ''),
          title: text(r.title as Rendered),
          content: text(r.content as Rendered),
          excerpt: text(r.excerpt as Rendered),
          author: Number(r.author ?? 0),
          featured_media: Number(r.featured_media ?? 0),
          parent: Number(r.parent ?? 0),
          menu_order: Number(r.menu_order ?? 0),
          template: String(r.template ?? ''),
        },
        ['content', 'excerpt'],
        ['title', 'slug', 'link'],
        rejected,
      ),
    )
    .filter((p): p is WpPage => p !== null)

  const categories = read('categories')
    .map((r) =>
      clean<WpCategory>(
        'category',
        {
          id: Number(r.id),
          name: String(r.name ?? ''),
          slug: String(r.slug ?? ''),
          description: String(r.description ?? ''),
          parent: Number(r.parent ?? 0),
          count: Number(r.count ?? 0),
        },
        [],
        ['name', 'slug', 'description'],
        rejected,
      ),
    )
    .filter((c): c is WpCategory => c !== null)

  const users = read('users').map((r) => ({
    id: Number(r.id),
    name: sanitize(String(r.name ?? '')).clean,
    slug: String(r.slug ?? ''),
  }))

  const media = read('media')
    .map((r) => {
      const details = (r.media_details ?? {}) as {
        width?: number
        height?: number
        sizes?: Record<string, { source_url?: string }>
      }
      const source = String(r.source_url ?? '')
      const variants = Object.values(details.sizes ?? {})
        .map((s) => s.source_url)
        .filter((u): u is string => typeof u === 'string')
      return clean<WpMedia>(
        'media',
        {
          id: Number(r.id),
          date_gmt: String(r.date_gmt ?? ''),
          slug: String(r.slug ?? ''),
          title: text(r.title as Rendered),
          alt_text: String(r.alt_text ?? ''),
          caption: text(r.caption as Rendered),
          mime_type: String(r.mime_type ?? ''),
          media_type: String(r.media_type ?? ''),
          source_url: source,
          filesize: typeof r.filesize === 'number' ? r.filesize : undefined,
          width: details.width,
          height: details.height,
          variantUrls: [...new Set([source, ...variants])],
          post: r.post == null ? null : Number(r.post),
        },
        ['caption'],
        ['title', 'alt_text', 'slug'],
        rejected,
      )
    })
    .filter((m): m is WpMedia => m !== null)

  return { posts, pages, categories, users, media, rejected }
}
