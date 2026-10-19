/**
 * YouTube Shorts of a channel, read from the channel's public "Shorts" tab (no API key needed).
 * Pure helpers only: finding the right address, picking the Shorts out of the page, tidying titles.
 * The fetching and caching live in features/shorts/queries.ts.
 */
export type Short = {
  id: string
  /** The headline, without the speaker / channel names that titles end with. */
  title: string
  /** The speaker, when the title names one. */
  subtitle: string | null
  /** As YouTube words it, e.g. "2.2K views". */
  views: string | null
  /** The vertical thumbnail, at the address YouTube itself gives for it. */
  thumb: string
}

const HANDLE = /^@[A-Za-z0-9._-]{3,30}$/
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])

/**
 * The channel's Shorts page, from whatever an editor typed: `@handle`, `handle`, a channel id
 * (`UC…`), or a youtube.com address of the channel. Null when it is none of those, so nothing
 * but a YouTube channel page is ever requested.
 */
export function shortsPage(input: string | null | undefined): string | null {
  const text = (input ?? '').trim()
  if (!text) return null
  let path: string | null = null
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      if (url.protocol !== 'https:' || !HOSTS.has(url.hostname.toLowerCase())) return null
      const [first, second] = url.pathname.split('/').filter(Boolean)
      if (first?.startsWith('@') && HANDLE.test(first)) path = first
      else if (first === 'channel' && second && CHANNEL_ID.test(second)) path = `channel/${second}`
    } catch {
      return null
    }
  } else if (CHANNEL_ID.test(text)) path = `channel/${text}`
  else if (HANDLE.test(text)) path = text
  else if (HANDLE.test(`@${text}`)) path = `@${text}`
  return path ? `https://www.youtube.com/${path}/shorts` : null
}

const BRAND = /dialogue|^#/i
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/**
 * Titles read "Headline | Speaker | Channel | Channel": keep the headline, and the speaker when the
 * next part is a name rather than a channel or a hashtag.
 */
export function splitTitle(raw: string): { title: string; subtitle: string | null } {
  const parts = raw
    .split('|')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const first = parts[0]
  if (!first) return { title: '', subtitle: null }
  // A title that is nothing but a channel name keeps its full text.
  if (BRAND.test(first)) return { title: clip(parts.join(' | '), 140), subtitle: null }
  const next = parts[1]
  return {
    title: clip(first, 140),
    subtitle: next && !BRAND.test(next) ? clip(next, 80) : null,
  }
}

type Json = { [key: string]: unknown }
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null
const text = (v: unknown): string | null =>
  isObject(v) && typeof v.content === 'string' ? v.content : null

/**
 * The thumbnail address YouTube gives for a Short on its Shorts page (the picture it shows there,
 * signature included), largest first. Only an `i.ytimg.com/vi/<this video>/…` address is used: the
 * site's image optimizer fetches nothing else, and an unknown host would break the page.
 */
function youtubeThumb(item: Json, id: string): string | null {
  const view = isObject(item.thumbnailViewModel) ? item.thumbnailViewModel : null
  const nested = view && isObject(view.thumbnailViewModel) ? view.thumbnailViewModel : view
  const image = nested && isObject(nested.image) ? nested.image : null
  const plain = isObject(item.thumbnail) ? item.thumbnail : null
  const sources = image?.sources ?? plain?.sources
  const best = (Array.isArray(sources) ? sources : [])
    .filter(isObject)
    .map((source) => ({
      url: typeof source.url === 'string' ? source.url : '',
      height: Number(source.height) || 0,
    }))
    .filter(({ url }) => {
      try {
        const u = new URL(url)
        return (
          u.protocol === 'https:' &&
          u.hostname === 'i.ytimg.com' &&
          u.pathname.startsWith(`/vi/${id}/`)
        )
      } catch {
        return false
      }
    })
    .sort((a, b) => b.height - a.height)[0]
  return best?.url ?? null
}

/**
 * Where else to look for a Short's thumbnail if the first address fails to load: the unsigned
 * vertical ones YouTube keeps for every Short, then the first frame of the video.
 */
export const thumbFallbacks = (id: string): string[] =>
  ['oar1', 'oardefault', 'oar2', 'frame0'].map((name) => `https://i.ytimg.com/vi/${id}/${name}.jpg`)

/** Every `shortsLockupViewModel` in the page data, in page order. */
function lockups(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) for (const item of node) lockups(item, out)
  else if (isObject(node))
    for (const [key, value] of Object.entries(node)) {
      if (key === 'shortsLockupViewModel' && isObject(value)) out.push(value)
      else lockups(value, out)
    }
  return out
}

/** The Shorts on a channel's Shorts page, newest first (the page's own order). Empty when nothing is recognised. */
export function parseShortsPage(html: string): Short[] {
  const marker = html.indexOf('var ytInitialData = ')
  if (marker < 0) return []
  const from = marker + 'var ytInitialData = '.length
  const to = html.indexOf(';</script>', from)
  if (to < 0) return []
  let data: unknown
  try {
    data = JSON.parse(html.slice(from, to))
  } catch {
    return []
  }
  const seen = new Set<string>()
  const shorts: Short[] = []
  for (const item of lockups(data)) {
    const tap = isObject(item.onTap) ? item.onTap : null
    const command = tap && isObject(tap.innertubeCommand) ? tap.innertubeCommand : null
    const watch = command && isObject(command.reelWatchEndpoint) ? command.reelWatchEndpoint : null
    const id =
      (typeof watch?.videoId === 'string' ? watch.videoId : null) ??
      (typeof item.entityId === 'string' ? item.entityId.replace('shorts-shelf-item-', '') : '')
    if (!VIDEO_ID.test(id) || seen.has(id)) continue
    const overlay = isObject(item.overlayMetadata) ? item.overlayMetadata : {}
    const raw = text(overlay.primaryText) ?? ''
    const { title, subtitle } = splitTitle(raw)
    if (!title) continue
    seen.add(id)
    shorts.push({
      id,
      title,
      subtitle,
      views: text(overlay.secondaryText),
      thumb: youtubeThumb(item, id) ?? thumbFallbacks(id)[0]!,
    })
  }
  return shorts
}
