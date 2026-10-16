/**
 * Pure helpers for the quick "Audio" and "Video" entries (link, title, author — all optional): the
 * name shown in the admin list, the title shown on the site, and the quick form's emptiness check.
 */
export type MediaKind = 'audio' | 'video'
export type MediaFields = { link?: string | null; title?: string | null; author?: string | null }

const FALLBACK: Record<MediaKind, string> = { audio: 'Audio', video: 'Video' }
const clean = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim()

/** `open.spotify.com` for a Spotify link; null for anything that is not a web address. */
export function linkHost(link: string | null | undefined): string | null {
  try {
    const url = new URL(clean(link))
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.hostname.replace(/^www\./, '')
      : null
  } catch {
    return null
  }
}

/** The name an entry has in the admin list: its title, else its author, else where it links to. */
export function itemLabel(fields: MediaFields, kind: MediaKind): string {
  const title = clean(fields.title)
  if (title) return title.length > 80 ? `${title.slice(0, 79)}…` : title
  return clean(fields.author) || linkHost(fields.link) || FALLBACK[kind]
}

/**
 * The title visitors see: the one the editor typed, else the one the link's own site reports
 * (YouTube / Spotify, fetched by the caller), else the author, else the link's host.
 */
export function displayTitle(
  fields: MediaFields,
  kind: MediaKind,
  reported?: string | null,
): string {
  return clean(fields.title) || clean(reported) || itemLabel({ ...fields, title: null }, kind)
}

/** True when at least one of link / title / author has something in it (the quick form's check). */
export const hasAnyField = (fields: MediaFields): boolean =>
  Boolean(clean(fields.link) || clean(fields.title) || clean(fields.author))

/** Newest entries first, then the posts, never more than `limit` in all. */
export function mergeFirst<T>(entries: T[], posts: T[], limit: number): T[] {
  return [...entries, ...posts].slice(0, Math.max(0, Math.floor(limit)))
}
