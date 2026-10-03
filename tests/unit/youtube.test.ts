import { afterEach, describe, expect, it, vi } from 'vitest'
import { statusFromOembed, youtubeStatus } from '@/lib/youtube'

afterEach(() => vi.unstubAllGlobals())

describe('statusFromOembed', () => {
  it.each([
    [200, 'ok'],
    [401, 'external'], // exists, but the owner turned embedding off (or it is private)
    [403, 'gone'], // removed for violating YouTube's Terms of Service
    [404, 'gone'], // deleted
    [400, 'gone'],
    [429, 'unknown'], // rate limited: no verdict, keep the player
    [500, 'unknown'],
  ] as const)('HTTP %i → %s', (code, status) => {
    expect(statusFromOembed(code)).toBe(status)
  })
})

describe('youtubeStatus', () => {
  it('asks YouTube oEmbed directly about the exact video, cached for hours', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(youtubeStatus('j4mVf_j6xF4')).resolves.toBe('gone')
    const [url, init] = fetchMock.mock.calls[0]!
    const u = new URL(url as string)
    expect(u.origin + u.pathname).toBe('https://www.youtube.com/oembed')
    expect(u.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=j4mVf_j6xF4')
    expect(u.searchParams.get('format')).toBe('json')
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBeGreaterThanOrEqual(
      3600,
    )
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })

  it('a live video is ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    await expect(youtubeStatus('wB70YxLsM-o')).resolves.toBe('ok')
  })

  it('network failure or timeout gives no verdict (the player still renders)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')))
    await expect(youtubeStatus('wB70YxLsM-o')).resolves.toBe('unknown')
  })

  it('never sends anything that is not a YouTube video id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(youtubeStatus('../../x?next=1')).resolves.toBe('gone')
    await expect(youtubeStatus('')).resolves.toBe('gone')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
