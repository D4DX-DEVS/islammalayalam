/**
 * Episodes of a Spotify show, as the Audios section needs them. Pure helpers only: finding the show
 * in a link, turning Spotify's answers into one shape, formatting lengths. The fetching and caching
 * live in features/spotify/queries.ts.
 */
export type Episode = {
  id: string
  title: string
  description: string
  /** "YYYY-MM-DD", or null when Spotify gave no usable date. */
  date: string | null
  durationSec: number | null
  /** Cover art (largest size offered); shown through the site's image optimizer. */
  image: string | null
  /** The episode's address on Spotify. */
  url: string
}

/** The show itself: what the Audios header shows. */
export type Show = {
  id: string
  name: string
  /** Who makes it, when Spotify says so (the embed page names only the show). */
  publisher: string | null
  image: string | null
  /** The show's address on Spotify (the Follow button goes here). */
  url: string
  /** How many episodes the show has, when known. */
  total: number | null
}

const ID = /^[A-Za-z0-9]{22}$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The id inside a Spotify link of the given kind (`show` / `episode`): web address or `spotify:` URI. */
function idOf(kind: 'show' | 'episode', link: string | null | undefined): string | null {
  const text = (link ?? '').trim()
  const uri = new RegExp(`^spotify:${kind}:([A-Za-z0-9]{22})$`).exec(text)
  if (uri) return uri[1]!
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null
    // Some links carry a language segment first: /intl-in/show/<id>.
    const parts = url.pathname.split('/').filter((p) => p && !/^intl-[a-z-]+$/i.test(p))
    return parts[0] === kind && parts[1] && ID.test(parts[1]) ? parts[1] : null
  } catch {
    return null
  }
}

export const spotifyShowId = (link: string | null | undefined): string | null => idOf('show', link)
export const spotifyEpisodeId = (link: string | null | undefined): string | null =>
  idOf('episode', link)

/** 158081 ms → "2:38"; an hour or more → "1:02:03". Null for a missing or zero length. */
export function clock(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 1) return null
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

/**
 * Cover art may only come from Spotify's own image hosts (the ones next.config.ts lets the image
 * optimizer fetch): anything else is dropped, so an unexpected address can never break the page.
 */
const IMAGE_HOST = /^(?:i\.scdn\.co|(?:[a-z0-9-]+\.)+spotifycdn\.com)$/
function coverUrl(value: unknown): string | null {
  try {
    const url = new URL(str(value))
    return url.protocol === 'https:' &&
      IMAGE_HOST.test(url.hostname) &&
      url.pathname.startsWith('/image/')
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/** 158 s → "3 min"; under half a minute still says "1 min". Null for a missing length. */
export function minutes(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 1) return null
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

type Image = { url?: unknown; width?: unknown }
/**
 * The largest usable picture of a list. The Web API gives sizes, so the widest wins; the embed page
 * gives none, and there Spotify lists them smallest first, so the last one wins.
 */
function bestImage(images: unknown): string | null {
  const list = (Array.isArray(images) ? images : []).filter(
    (i): i is Image => isObject(i) && coverUrl(i.url) !== null,
  )
  const widest = list.reduce<Image | null>(
    (best, i) => (!best || Number(i.width ?? 0) >= Number(best.width ?? 0) ? i : best),
    null,
  )
  return widest ? coverUrl(widest.url) : null
}

const day = (value: unknown): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(str(value))
  return m ? m[1]! : null
}

/** Episodes from Spotify's Web API answer for `GET /v1/shows/{id}/episodes`, in the order given (newest first). */
export function parseApiEpisodes(json: unknown): Episode[] {
  const items = isObject(json) && Array.isArray(json.items) ? json.items : []
  const seen = new Set<string>()
  return items.flatMap((item): Episode[] => {
    if (!isObject(item)) return []
    const id = str(item.id)
    const title = str(item.name).trim()
    if (!ID.test(id) || !title || seen.has(id) || item.is_playable === false) return []
    seen.add(id)
    const ms = Number(item.duration_ms)
    return [
      {
        id,
        title,
        description: str(item.description).trim(),
        date: day(item.release_date),
        durationSec: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null,
        image: bestImage(item.images),
        url: `https://open.spotify.com/episode/${id}`,
      },
    ]
  })
}

/** The show from Spotify's Web API answer for `GET /v1/shows/{id}`. */
export function parseApiShow(json: unknown): Show | null {
  if (!isObject(json)) return null
  const id = str(json.id)
  const name = str(json.name).trim()
  if (!ID.test(id) || !name) return null
  const total = Number(json.total_episodes)
  return {
    id,
    name,
    publisher: str(json.publisher).trim() || null,
    image: bestImage(json.images),
    url: `https://open.spotify.com/show/${id}`,
    total: Number.isFinite(total) && total >= 0 ? total : null,
  }
}

/**
 * The show and its newest episode, from the show's public embed page (no account needed): the page's
 * own data names the latest episode, its own thumbnail, and the show it belongs to. Null when the
 * page has no episode in it.
 */
export function parseEmbed(html: string): { show: Show | null; episode: Episode } | null {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) return null
  let data: unknown
  try {
    data = JSON.parse(m[1]!)
  } catch {
    return null
  }
  const pageProps = isObject(data) && isObject(data.props) ? data.props.pageProps : null
  const state = isObject(pageProps) ? pageProps.state : null
  const inner = isObject(state) ? state.data : null
  const entity = isObject(inner) ? inner.entity : null
  if (!isObject(entity) || entity.type !== 'episode') return null
  const id = str(entity.id)
  const title = (str(entity.title) || str(entity.name)).trim()
  if (!ID.test(id) || !title) return null
  const release = isObject(entity.releaseDate) ? entity.releaseDate.isoString : null
  const ms = Number(entity.duration)
  const cover = bestImage(entity.relatedEntityCoverArt)
  const showId = spotifyShowId(str(entity.relatedEntityUri))
  const showName = str(entity.subtitle).trim()
  return {
    episode: {
      id,
      title,
      description: '',
      date: day(release),
      durationSec: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null,
      // The episode's own thumbnail (video podcasts have one), else the show's cover.
      image: bestImage(entity.videoThumbnailImage) ?? cover,
      url: `https://open.spotify.com/episode/${id}`,
    },
    show:
      showId && showName
        ? {
            id: showId,
            name: showName,
            publisher: null,
            image: cover,
            url: `https://open.spotify.com/show/${showId}`,
            total: null,
          }
        : null,
  }
}
