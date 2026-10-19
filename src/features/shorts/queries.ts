import 'server-only'
import { unstable_cache } from 'next/cache'
import { parseShortsPage, shortsPage, type Short } from '@/lib/youtube-shorts'

/**
 * The latest Shorts of a YouTube channel, for the homepage carousel. Read from the channel's public
 * Shorts page and kept for a quarter of an hour, so a Short uploaded to the channel shows up on the
 * site by itself, with no editing. If YouTube cannot be reached (or changes its page), the last list
 * that worked keeps being shown, and the section only disappears when there never was one.
 */
const REFRESH_SECONDS = 15 * 60
const lastGood = new Map<string, Short[]>()

async function load(page: string): Promise<Short[]> {
  const res = await fetch(page, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept-Language': 'en',
      // Skips the cookie-consent page some countries are sent to.
      Cookie: 'SOCS=CAI',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`YouTube answered ${res.status}`)
  const shorts = parseShortsPage(await res.text())
  // Thrown, not returned: an empty answer must not be cached for the next quarter of an hour.
  if (!shorts.length) throw new Error('No Shorts found on the page')
  return shorts
}

const loadCached = unstable_cache(load, ['shorts:channel:v2'], {
  revalidate: REFRESH_SECONDS,
  tags: ['shorts'],
})

/** Up to `limit` of the channel's newest Shorts; `[]` when the channel is not valid or none can be read. */
export async function getChannelShorts(channel: string, limit: number): Promise<Short[]> {
  const page = shortsPage(channel)
  if (!page) return []
  try {
    const shorts = await loadCached(page)
    lastGood.set(page, shorts)
    return shorts.slice(0, limit)
  } catch (err) {
    console.warn('[shorts] could not refresh', page, (err as Error).message)
    return (lastGood.get(page) ?? []).slice(0, limit)
  }
}
