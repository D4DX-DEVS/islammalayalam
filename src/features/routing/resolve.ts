import 'server-only'
import { cache } from 'react'
import {
  findPostNumberByLegacySlug,
  getPostByNumber,
  getPostPreview,
} from '@/features/posts/queries'
import { getPageByPath } from '@/features/pages/queries'
import { getPreviewUser } from '@/features/preview/session'
import { findRedirect } from '@/features/redirects/queries'
import { encodePath, normalizePath, toPath } from '@/lib/text/slug'
import type { Page, Post } from '@/payload-types'

export { encodePath }

export type Resolution =
  | { kind: 'post'; post: Post }
  | { kind: 'page'; page: Page }
  | { kind: 'redirect'; to: string }
  | { kind: 'gone' }
  | { kind: 'not-found' }

const MAX_SEGMENTS = 10
const POST_NUMBER = /^\d{1,9}$/

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment).normalize('NFC')
  } catch {
    return segment.normalize('NFC')
  }
}

function redirectTarget(to: string): string | null {
  if (to.startsWith('/') && !to.startsWith('//')) return encodePath(to)
  return /^https:\/\/[^\s]+$/.test(to) ? to : null
}

/** Where a canonical path (/a/b/) permanently moved to, per the redirects table (null: no move). */
export async function movedTo(canonical: string): Promise<string | null> {
  const hit = await findRedirect(canonical)
  if (!hit || hit.code === '410' || !hit.to) return null
  const to = redirectTarget(hit.to)
  return to && to !== encodePath(canonical) ? to : null
}

/**
 * Resolve a public URL (everything not matched by a more specific route):
 *   1. non-canonical spelling (legacy chillu, case, invisible chars) → 301 to the canonical form
 *   2. /<number>/            → post (the WordPress /{id}/ permalink)
 *   3. /a/b/c/               → knowledge-base page by path
 *   4. redirects table       → 301/308/410 (migration + automatic moves)
 *   5. /<legacy-slug>/       → 301 to the post's /<number>/
 */
async function resolveUncached(rawSegments: string[]): Promise<Resolution> {
  if (!rawSegments.length || rawSegments.length > MAX_SEGMENTS) return { kind: 'not-found' }
  const segments = normalizePath(`/${rawSegments.join('/')}`)
  if (!segments?.length) return { kind: 'not-found' }

  const canonical = toPath(segments)
  const requested = `/${rawSegments.map(safeDecode).join('/')}/`
  const result = await resolveCanonicalPath(segments, canonical)
  if (requested === canonical) return result
  // Non-canonical spelling (legacy chillu, case, invisible chars): one hop straight to the final URL.
  if (result.kind === 'post' || result.kind === 'page')
    return { kind: 'redirect', to: encodePath(canonical) }
  return result
}

async function resolveCanonicalPath(segments: string[], canonical: string): Promise<Resolution> {
  const direct = await resolveCanonical(segments)
  if (direct) return direct

  const hit = await findRedirect(canonical)
  if (hit?.code === '410') return { kind: 'gone' }
  const to = hit ? await movedTo(canonical) : null
  if (to) return { kind: 'redirect', to }

  if (segments.length === 1) {
    const postNumber = await findPostNumberByLegacySlug(segments[0]!)
    if (postNumber) return { kind: 'redirect', to: `/${postNumber}/` }
  }
  return { kind: 'not-found' }
}

async function resolveCanonical(
  segments: string[],
): Promise<Extract<Resolution, { kind: 'post' | 'page' }> | null> {
  if (segments.length === 1 && POST_NUMBER.test(segments[0]!)) {
    // Verified staff in preview mode see the latest draft; everyone else the published post.
    const previewer = await getPreviewUser()
    const n = Number(segments[0])
    const post = previewer ? await getPostPreview(n, previewer) : await getPostByNumber(n)
    if (post) return { kind: 'post', post }
  }
  const page = await getPageByPath(segments.join('/'))
  return page ? { kind: 'page', page } : null
}

const resolveByKey = cache((key: string) => resolveUncached(key ? key.split('/') : []))

/** Request-deduplicated: the segment layout (status codes) and the page (render) share one lookup. */
export const resolvePath = (rawSegments: string[]): Promise<Resolution> =>
  resolveByKey(rawSegments.join('/'))
