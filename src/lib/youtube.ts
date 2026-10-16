import 'server-only'

/**
 * Is a YouTube video still playable in an embed? Asked of YouTube itself (its public oEmbed
 * endpoint), server-side and cached, so a video YouTube has removed shows our own notice instead
 * of YouTube's grey "Video unavailable" player. Unit-tested in tests/unit/youtube.test.ts.
 *
 * ok       — embeddable
 * external — exists, but the owner disabled embedding (or made it private): link out to YouTube
 * gone     — removed (Terms of Service), deleted, or not a video id at all
 * unknown  — no verdict (rate limit, outage, timeout): render the player as before
 */
export type VideoStatus = 'ok' | 'external' | 'gone' | 'unknown'

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const RECHECK_SECONDS = 6 * 60 * 60
const TIMEOUT_MS = 2500

export function statusFromOembed(httpStatus: number): VideoStatus {
  if (httpStatus === 200) return 'ok'
  if (httpStatus === 401) return 'external'
  if (httpStatus === 400 || httpStatus === 403 || httpStatus === 404) return 'gone'
  return 'unknown'
}

export async function youtubeStatus(id: string): Promise<VideoStatus> {
  if (!VIDEO_ID.test(id)) return 'gone'
  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`)
  endpoint.searchParams.set('format', 'json')
  try {
    const res = await fetch(endpoint.toString(), {
      next: { revalidate: RECHECK_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return statusFromOembed(res.status)
  } catch {
    return 'unknown'
  }
}

/** The title and channel an oEmbed response reports (either may be missing). */
export function parseOembed(body: unknown): { title: string | null; author: string | null } {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim()
      ? value.replace(/\s+/g, ' ').trim().slice(0, 300)
      : null
  return { title: text(record.title), author: text(record.author_name) }
}

export type VideoDetails = { status: VideoStatus; title: string | null; author: string | null }

/** Status (as above) plus the title and channel YouTube reports, from the same cached request. */
export async function youtubeDetails(id: string): Promise<VideoDetails> {
  if (!VIDEO_ID.test(id)) return { status: 'gone', title: null, author: null }
  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`)
  endpoint.searchParams.set('format', 'json')
  try {
    const res = await fetch(endpoint.toString(), {
      next: { revalidate: RECHECK_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const status = statusFromOembed(res.status)
    if (status !== 'ok') return { status, title: null, author: null }
    return { status, ...parseOembed(await res.json().catch(() => null)) }
  } catch {
    return { status: 'unknown', title: null, author: null }
  }
}
