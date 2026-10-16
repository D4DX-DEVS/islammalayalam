import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseOembed, statusFromOembed, youtubeDetails, youtubeStatus } from '@/lib/youtube'

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

describe('parseOembed', () => {
  it('reads the title and the channel', () => {
    expect(parseOembed({ title: '  Hello   world ', author_name: 'A Channel' })).toEqual({
      title: 'Hello world',
      author: 'A Channel',
    })
  })

  it('tolerates missing, empty and wrong-typed values', () => {
    expect(parseOembed({})).toEqual({ title: null, author: null })
    expect(parseOembed(null)).toEqual({ title: null, author: null })
    expect(parseOembed('text')).toEqual({ title: null, author: null })
    expect(parseOembed({ title: '   ', author_name: 42 })).toEqual({ title: null, author: null })
  })

  it('shortens an absurdly long title', () => {
    expect(parseOembed({ title: 'x'.repeat(1000) }).title).toHaveLength(300)
  })
})

describe('youtubeDetails', () => {
  it('returns the status together with the reported title and channel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ title: 'T', author_name: 'C' }), { status: 200 }),
      ),
    )
    expect(await youtubeDetails('fvRsB9zkoxM')).toEqual({ status: 'ok', title: 'T', author: 'C' })
  })

  it('gives no title for a removed video, and "gone" for a bad id without asking YouTube', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await youtubeDetails('fvRsB9zkoxM')).toEqual({
      status: 'gone',
      title: null,
      author: null,
    })
    fetchMock.mockClear()
    expect((await youtubeDetails('nope')).status).toBe('gone')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('has no verdict when YouTube cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await youtubeDetails('fvRsB9zkoxM')).toEqual({
      status: 'unknown',
      title: null,
      author: null,
    })
  })
})
