import 'server-only'
import { parseOembed } from '@/lib/youtube'
import { spotifyOpenUrl } from '@/lib/security/url'

const RECHECK_SECONDS = 6 * 60 * 60
const TIMEOUT_MS = 2500

/**
 * The title Spotify reports for an episode / show / playlist link (its public oEmbed endpoint),
 * so an entry added with only a link still gets a proper name. Server-side and cached; null when
 * Spotify says nothing (unknown link, outage, timeout).
 */
export async function spotifyTitle(link: string): Promise<string | null> {
  const open = spotifyOpenUrl(link)
  if (!open) return null
  const endpoint = new URL('https://open.spotify.com/oembed')
  endpoint.searchParams.set('url', open)
  try {
    const res = await fetch(endpoint.toString(), {
      next: { revalidate: RECHECK_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok ? parseOembed(await res.json().catch(() => null)).title : null
  } catch {
    return null
  }
}
