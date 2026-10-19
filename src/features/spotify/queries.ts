import 'server-only'
import { unstable_cache } from 'next/cache'
import { getHomepage } from '@/features/site/queries'
import { getEnv } from '@/lib/env'
import {
  parseApiEpisodes,
  parseApiShow,
  parseEmbed,
  spotifyEpisodeId,
  spotifyShowId,
  type Episode,
  type Show,
} from '@/lib/spotify-show'

/**
 * A Spotify show and its episodes, for the Audios section. A quarter of an hour at most after an
 * episode is published on Spotify it is on the site, with nobody editing anything.
 *
 * - With a Spotify app (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET) the whole show is listed, newest
 *   first, with descriptions, through Spotify's own Web API (client-credentials: public catalogue
 *   data only).
 * - Without one, the show's public embed page still names the show and its newest episode, so that
 *   one appears by itself (just the one).
 * - If Spotify cannot be reached, the last answer that worked keeps being shown.
 */
const REFRESH_SECONDS = 15 * 60
const MARKET = 'IN'
const MAX_EPISODES = 50
const TIMEOUT_MS = 10_000
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export type ShowFeed = { show: Show | null; episodes: Episode[] }

const lastGood = new Map<string, ShowFeed>()
let token: { value: string; expiresAt: number } | null = null

/** An app access token, kept until a minute before it expires; null when no Spotify app is set up. */
async function clientToken(force = false): Promise<string | null> {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = getEnv()
  if (!id || !secret) return null
  if (!force && token && token.expiresAt > Date.now() + 60_000) return token.value
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Spotify sign-in answered ${res.status}`)
  const json = (await res.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
  } | null
  if (!json?.access_token) throw new Error('Spotify gave no access token')
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return token.value
}

/** The show and all its episodes through the Web API, or null when no Spotify app is set up. */
async function fromApi(showId: string): Promise<{ show: Show | null; episodes: Episode[] } | null> {
  let access = await clientToken()
  if (!access) return null
  const api = `https://api.spotify.com/v1/shows/${showId}`
  const get = (path: string, bearer: string) =>
    fetch(`${api}${path}`, {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  let episodes = await get(`/episodes?market=${MARKET}&limit=${MAX_EPISODES}`, access)
  if (episodes.status === 401) {
    access = await clientToken(true) // the token ran out early: sign in again, once
    episodes = await get(`/episodes?market=${MARKET}&limit=${MAX_EPISODES}`, access!)
  }
  if (!episodes.ok) throw new Error(`Spotify answered ${episodes.status}`)
  // The show's own details are a nicety: if that call fails the episodes are still shown.
  const details = await get(`?market=${MARKET}`, access!).catch(() => null)
  return {
    episodes: parseApiEpisodes(await episodes.json().catch(() => null)),
    show: details?.ok ? parseApiShow(await details.json().catch(() => null)) : null,
  }
}

/** The show and its newest episode, from the show's public embed page. */
async function fromEmbed(showId: string): Promise<ReturnType<typeof parseEmbed>> {
  const res = await fetch(`https://open.spotify.com/embed/show/${showId}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Spotify embed page answered ${res.status}`)
  return parseEmbed(await res.text())
}

async function load(showId: string): Promise<ShowFeed> {
  let api: Awaited<ReturnType<typeof fromApi>> = null
  try {
    api = await fromApi(showId)
  } catch (err) {
    console.warn('[spotify] the Web API failed, trying the embed page:', (err as Error).message)
  }
  // The embed page is only needed for what the API did not give.
  const embed = api?.episodes.length && api.show ? null : await fromEmbed(showId).catch(() => null)
  const episodes = api?.episodes.length ? api.episodes : embed ? [embed.episode] : []
  // Thrown, not returned: an empty answer must not be kept for the next quarter of an hour.
  if (!episodes.length) throw new Error('No episodes found for the show')
  return { show: api?.show ?? embed?.show ?? null, episodes }
}

const loadCached = unstable_cache(load, ['spotify:show:v2'], {
  revalidate: REFRESH_SECONDS,
  tags: ['spotify'],
})

/** The show and up to `limit` of its newest episodes; nothing when the link is not a show or none can be read. */
export async function getShowFeed(
  link: string | null | undefined,
  limit: number,
): Promise<ShowFeed> {
  const showId = spotifyShowId(link)
  if (!showId) return { show: null, episodes: [] }
  try {
    const feed = await loadCached(showId)
    lastGood.set(showId, feed)
    return { show: feed.show, episodes: feed.episodes.slice(0, limit) }
  } catch (err) {
    console.warn('[spotify] could not refresh', showId, (err as Error).message)
    const kept = lastGood.get(showId)
    return kept
      ? { show: kept.show, episodes: kept.episodes.slice(0, limit) }
      : { show: null, episodes: [] }
  }
}

const EPISODE_REFRESH_SECONDS = 6 * 60 * 60
const lastEpisode = new Map<string, Episode>()

/** One episode's own embed page: title, date, length and cover (no account needed). */
async function fetchEpisode(id: string): Promise<Episode> {
  const res = await fetch(`https://open.spotify.com/embed/episode/${id}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Spotify embed page answered ${res.status}`)
  const parsed = parseEmbed(await res.text())
  // Thrown, not returned: a page with no episode in it must not be kept for hours.
  if (!parsed || parsed.episode.id !== id) throw new Error('No episode data on the page')
  return parsed.episode
}

const loadEpisode = unstable_cache(fetchEpisode, ['spotify:episode:v1'], {
  revalidate: EPISODE_REFRESH_SECONDS,
  tags: ['spotify'],
})

/**
 * The details of a Spotify episode link added by hand (Admin → Audios), so such an entry is listed
 * with its picture, date and length like an episode of the show. Null when the link is not an
 * episode or Spotify cannot be reached and nothing was kept from before.
 */
export async function getEpisode(link: string | null | undefined): Promise<Episode | null> {
  const id = spotifyEpisodeId(link)
  if (!id) return null
  try {
    const episode = await loadEpisode(id)
    lastEpisode.set(id, episode)
    return episode
  } catch (err) {
    console.warn('[spotify] could not read episode', id, (err as Error).message)
    return lastEpisode.get(id) ?? null
  }
}

/**
 * The Spotify show behind the homepage's Audios section (the show link set on it in Admin → Homepage),
 * or null when no Audios section has one. The /audios/ page is built from it.
 */
export async function audioShowLink(): Promise<string | null> {
  const home = await getHomepage()
  const blocks = [...(home.layout ?? []), ...(home.sidebar ?? [])]
  for (const block of blocks) {
    if (block.blockType !== 'mediaShelf' || block.format !== 'audio' || block.hidden) continue
    if (spotifyShowId(block.spotifyUrl)) return block.spotifyUrl ?? null
  }
  return null
}
