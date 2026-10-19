import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The Shorts the homepage shows: fetched from the channel, kept, and never lost to a bad moment. */
vi.mock('next/cache', () => ({
  // No cache in the test: every call reaches the loader, like the first call after expiry.
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}))

const { getChannelShorts } = await import('@/features/shorts/queries')

const lockup = (id: string, title: string) => ({
  shortsLockupViewModel: {
    onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: id } } },
    overlayMetadata: { primaryText: { content: title }, secondaryText: { content: '1K views' } },
  },
})
const html = (...ids: string[]) =>
  `<script>var ytInitialData = ${JSON.stringify({ items: ids.map((id) => lockup(id, `Short ${id}`)) })};</script>`
const ok = (body: string) => new Response(body, { status: 200 })

const ids = ['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC']
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getChannelShorts', () => {
  it('reads the channel’s Shorts page and returns the newest ones, up to the limit', async () => {
    fetchMock.mockResolvedValueOnce(ok(html(...ids)))
    const shorts = await getChannelShorts('@Ok_Channel', 2)
    expect(shorts.map((s) => s.id)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('https://www.youtube.com/@Ok_Channel/shorts')
  })

  it('picks up a newly uploaded Short on the next refresh', async () => {
    fetchMock.mockResolvedValueOnce(ok(html('AAAAAAAAAAA')))
    expect((await getChannelShorts('@Fresh_Channel', 5)).map((s) => s.id)).toEqual(['AAAAAAAAAAA'])
    fetchMock.mockResolvedValueOnce(ok(html('NEWNEWNEW_1', 'AAAAAAAAAAA')))
    expect((await getChannelShorts('@Fresh_Channel', 5)).map((s) => s.id)).toEqual([
      'NEWNEWNEW_1',
      'AAAAAAAAAAA',
    ])
  })

  it('keeps showing the last list that worked when YouTube fails or changes its page', async () => {
    fetchMock.mockResolvedValueOnce(ok(html(...ids)))
    await getChannelShorts('@Steady_Channel', 5)
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    expect(await getChannelShorts('@Steady_Channel', 5)).toHaveLength(3)
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await getChannelShorts('@Steady_Channel', 5)).toHaveLength(3)
    fetchMock.mockResolvedValueOnce(ok('<html>a page we do not recognise</html>'))
    expect(await getChannelShorts('@Steady_Channel', 2)).toHaveLength(2)
  })

  it('is empty (so the section hides) when nothing has ever worked', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))
    expect(await getChannelShorts('@Never_Worked', 5)).toEqual([])
  })

  it('never asks YouTube about something that is not a channel', async () => {
    expect(await getChannelShorts('https://evil.example/@x', 5)).toEqual([])
    expect(await getChannelShorts('', 5)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
