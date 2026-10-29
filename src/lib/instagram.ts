/**
 * The newest picture posts of the site's Instagram account, for the homepage Insights slider and
 * the /insights/ archive. Pure helpers only (addresses and parsing); the fetching, caching and token
 * upkeep live in features/instagram/queries.ts.
 *
 * Instagram only allows this through its official API ("Instagram API with Instagram Login"), with
 * a long-lived token of a Professional (Business or Creator) account. Videos and Reels are skipped:
 * Insights are posters.
 */
export type InstagramPost = {
  id: string
  /** The picture, on Instagram's own CDN (the address expires after a few days; it is re-read often). */
  image: string
  /** The caption without its trailing block of hashtags. */
  caption: string
  /** The post on instagram.com. */
  permalink: string
  /** ISO date it was posted. */
  timestamp: string | null
}

const GRAPH = 'https://graph.instagram.com'
const VERSION = 'v23.0'
const FIELDS = 'id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}'
/** Pictures only ever come from Instagram's own CDNs; anything else is ignored. */
const IMAGE_HOST = /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/i
const CAPTION_MAX = 600

/** The account's newest posts (up to `limit`, max 100), read with its own token. */
export function mediaEndpoint(token: string, limit: number): string {
  const url = new URL(`${GRAPH}/${VERSION}/me/media`)
  url.searchParams.set('fields', FIELDS)
  url.searchParams.set('limit', String(Math.min(100, Math.max(1, Math.floor(limit)))))
  url.searchParams.set('access_token', token)
  return url.toString()
}

/** Renew a stored token once it is a week old (tokens last 60 days; renewal needs a day). */
export const RENEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export type StoredToken = {
  token?: string | null
  refreshedAt?: string | null
  /** sha256 of the INSTAGRAM_ACCESS_TOKEN the stored token was renewed from. */
  sourceHash?: string | null
}

/**
 * Which token to use and whether to renew it first. The stored (renewed) token only counts while it
 * descends from the token in the environment now (`envHash`): replacing the variable always takes
 * effect, and another environment's token can never take over.
 */
export function chooseToken(
  stored: StoredToken,
  envToken: string,
  envHash: string,
  now: number = Date.now(),
): { token: string; renew: boolean; fallback: string | null } {
  const own = stored.token && stored.sourceHash === envHash ? stored.token : null
  if (!own) return { token: envToken, renew: true, fallback: null }
  const age = now - (Date.parse(stored.refreshedAt ?? '') || 0)
  return { token: own, renew: age >= RENEW_AFTER_MS, fallback: envToken }
}

/** Swaps a long-lived token (at least a day old) for a new one valid for another 60 days. */
export function refreshEndpoint(token: string): string {
  const url = new URL(`${GRAPH}/refresh_access_token`)
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)
  return url.toString()
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function imageUrl(value: unknown): string | null {
  try {
    const url = new URL(str(value))
    return url.protocol === 'https:' && IMAGE_HOST.test(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function postUrl(value: unknown): string | null {
  try {
    const url = new URL(str(value))
    return url.protocol === 'https:' && /^(?:www\.)?instagram\.com$/i.test(url.hostname)
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/** The caption as text: hashtag-only lines dropped, whitespace tidied, at most 600 characters. */
export function cleanCaption(raw: unknown): string {
  const text = str(raw)
    .split('\n')
    .filter((line) => !/^\s*(?:[#@][^\s#@]+\s*)+$/.test(line))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > CAPTION_MAX ? `${text.slice(0, CAPTION_MAX - 1)}…` : text
}

type RawMedia = {
  id?: unknown
  caption?: unknown
  media_type?: unknown
  media_url?: unknown
  permalink?: unknown
  timestamp?: unknown
  children?: { data?: RawMedia[] }
}

/** The picture of a post: the image itself, or a carousel's first image. Videos and Reels: none. */
function pictureOf(item: RawMedia): string | null {
  if (item.media_type === 'IMAGE') return imageUrl(item.media_url)
  if (item.media_type === 'CAROUSEL_ALBUM') {
    const first = (item.children?.data ?? []).find((c) => c.media_type === 'IMAGE')
    return first ? imageUrl(first.media_url) : null
  }
  return null
}

/** Picture posts out of a `/me/media` answer, newest first as Instagram returns them. */
export function parseMedia(json: unknown): InstagramPost[] {
  const data = (json as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  return (data as RawMedia[]).flatMap((item) => {
    const id = str(item.id)
    const image = pictureOf(item)
    const permalink = postUrl(item.permalink)
    if (!/^\d+$/.test(id) || !image || !permalink) return []
    const time = Date.parse(str(item.timestamp))
    return [
      {
        id,
        image,
        caption: cleanCaption(item.caption),
        permalink,
        timestamp: Number.isNaN(time) ? null : new Date(time).toISOString(),
      },
    ]
  })
}
