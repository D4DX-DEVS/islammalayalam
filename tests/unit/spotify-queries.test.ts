import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The Spotify show behind the Audios section: fetched, kept for a while, never lost to a bad moment. */
const env = vi.hoisted(() => ({
  state: {
    SPOTIFY_CLIENT_ID: undefined as string | undefined,
    SPOTIFY_CLIENT_SECRET: undefined as string | undefined,
  },
}))
vi.mock('@/lib/env', () => ({ getEnv: () => ({ ...env.state }) }))
const home = vi.hoisted(() => ({ state: { layout: [] as unknown[], sidebar: [] as unknown[] } }))
vi.mock('@/features/site/queries', () => ({ getHomepage: async () => ({ ...home.state }) }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  // No cache in the test: every call reaches the loader, like the first call after it expires.
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}))

const SHOW = '033wtcM4m46cI7qpurWrMC'
const LINK = `https://open.spotify.com/show/${SHOW}?si=abc`
const ids = [
  '3JTKn7MwgvUzXwK4p9Aayw',
  '0Q86acNRm6V9GYx55SXKwf',
  '7ouMYWpwJ422jRcDASZB7P',
  '4VqPOruhp5EdPBeR92t6lQ',
]
const apiBody = (n: number) => ({
  items: ids.slice(0, n).map((id, i) => ({
    id,
    name: `Episode ${i + 1}`,
    release_date: `2026-10-${17 - i}`,
    duration_ms: 120000 + i,
    images: [{ url: `https://i.scdn.co/image/${i}`, width: 640 }],
  })),
})
const showBody = {
  id: SHOW,
  name: 'Dialogue Media',
  publisher: 'Dialogue Media Team',
  total_episodes: 3,
  images: [{ url: 'https://i.scdn.co/image/show', width: 640 }],
}
const embedHtml = (id: string, name: string) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        state: {
          data: {
            entity: {
              type: 'episode',
              id,
              name,
              subtitle: 'From the embed',
              relatedEntityUri: `spotify:show:${SHOW}`,
              relatedEntityCoverArt: [{ url: 'https://i.scdn.co/image/embed-cover' }],
              releaseDate: { isoString: '2026-10-17T10:05:00Z' },
              duration: 158081,
            },
          },
        },
      },
    },
  })}</script>`
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>
const fetchMock = vi.fn()
const route = (handler: Handler) =>
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
    handler(String(url), init),
  )
const calls = (part: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(part))

let getShowFeed: typeof import('@/features/spotify/queries').getShowFeed
let audioShowLink: typeof import('@/features/spotify/queries').audioShowLink
let getEpisode: typeof import('@/features/spotify/queries').getEpisode
beforeEach(async () => {
  vi.resetModules()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  env.state.SPOTIFY_CLIENT_ID = undefined
  env.state.SPOTIFY_CLIENT_SECRET = undefined
  home.state = { layout: [], sidebar: [] }
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  ;({ getShowFeed, audioShowLink, getEpisode } = await import('@/features/spotify/queries'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const withKeys = () => {
  env.state.SPOTIFY_CLIENT_ID = 'i'.repeat(32)
  env.state.SPOTIFY_CLIENT_SECRET = 's'.repeat(32)
}
let tokens = 0
const spotify =
  (
    over: { episodes?: Handler; details?: Handler; embed?: Handler; token?: Handler } = {},
  ): Handler =>
  (url, init) => {
    if (url.includes('accounts.spotify.com'))
      return over.token
        ? over.token(url, init)
        : json({ access_token: `T${++tokens}`, expires_in: 3600 })
    if (url.includes('api.spotify.com/v1/shows/') && url.includes('/episodes'))
      return over.episodes ? over.episodes(url, init) : json(apiBody(3))
    if (url.includes('api.spotify.com/v1/shows/'))
      return over.details ? over.details(url, init) : json(showBody)
    if (url.includes('/embed/show/'))
      return over.embed
        ? over.embed(url, init)
        : new Response(embedHtml(ids[0]!, 'Newest'), { status: 200 })
    return new Response('?', { status: 404 })
  }

describe('with a Spotify app (the whole show)', () => {
  beforeEach(() => withKeys())

  it('lists the show’s episodes, newest first, up to the limit', async () => {
    route(spotify())
    const { episodes } = await getShowFeed(LINK, 2)
    expect(episodes.map((e) => e.title)).toEqual(['Episode 1', 'Episode 2'])
    const [url, init] = calls('/episodes')[0]!
    expect(String(url)).toContain(`/v1/shows/${SHOW}/episodes?market=IN&limit=50`)
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer T\d+$/),
    })
  })

  it('names the show from the API, and never needs the embed page', async () => {
    route(spotify())
    const { show } = await getShowFeed(LINK, 5)
    expect(show).toEqual({
      id: SHOW,
      name: 'Dialogue Media',
      publisher: 'Dialogue Media Team',
      image: 'https://i.scdn.co/image/show',
      url: `https://open.spotify.com/show/${SHOW}`,
      total: 3,
    })
    expect(calls('/embed/show/')).toHaveLength(0)
    expect(String(calls('api.spotify.com')[1]![0])).toContain(`/v1/shows/${SHOW}?market=IN`)
  })

  it('still lists the episodes when the show’s details cannot be had, naming the show from the embed page', async () => {
    route(spotify({ details: () => json({}, 500) }))
    const feed = await getShowFeed(LINK, 5)
    expect(feed.episodes).toHaveLength(3)
    expect(feed.show).toMatchObject({ id: SHOW, name: 'From the embed', publisher: null })
  })

  it('signs in with the app keys, and keeps the token for the next refresh', async () => {
    route(spotify())
    await getShowFeed(LINK, 5)
    await getShowFeed(LINK, 5)
    const [, init] = calls('accounts.spotify.com')[0]!
    expect(calls('accounts.spotify.com')).toHaveLength(1)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBe('grant_type=client_credentials')
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${'i'.repeat(32)}:${'s'.repeat(32)}`).toString('base64')}`,
    )
  })

  it('signs in again, once, when Spotify says the token has run out', async () => {
    let first = true
    route(
      spotify({ episodes: () => (first ? ((first = false), json({}, 401)) : json(apiBody(2))) }),
    )
    expect((await getShowFeed(LINK, 5)).episodes.map((e) => e.title)).toEqual([
      'Episode 1',
      'Episode 2',
    ])
    expect(calls('accounts.spotify.com')).toHaveLength(2)
  })

  it('picks up a newly published episode on the next refresh', async () => {
    let n = 2
    route(spotify({ episodes: () => json(apiBody(n)) }))
    expect((await getShowFeed(LINK, 10)).episodes).toHaveLength(2)
    n = 3
    expect((await getShowFeed(LINK, 10)).episodes).toHaveLength(3)
  })

  it('falls back to the newest episode from the embed page when the API fails', async () => {
    route(spotify({ episodes: () => json({}, 429) }))
    const { show, episodes } = await getShowFeed(LINK, 5)
    expect(episodes).toHaveLength(1)
    expect(episodes[0]).toMatchObject({ id: ids[0], title: 'Newest' })
    expect(show).toMatchObject({ id: SHOW, name: 'From the embed' })
  })

  it('does the same when signing in fails, or the API lists nothing', async () => {
    route(spotify({ token: () => json({}, 400) }))
    expect((await getShowFeed(LINK, 5)).episodes[0]!.title).toBe('Newest')
    route(spotify({ episodes: () => json({ items: [] }) }))
    expect((await getShowFeed(LINK, 5)).episodes[0]!.title).toBe('Newest')
  })
})

describe('without a Spotify app (the newest episode)', () => {
  it('reads the newest episode from the show’s embed page, and never asks Spotify to sign in', async () => {
    route(spotify())
    const { show, episodes } = await getShowFeed(LINK, 5)
    expect(episodes.map((e) => e.title)).toEqual(['Newest'])
    expect(show).toMatchObject({
      name: 'From the embed',
      image: 'https://i.scdn.co/image/embed-cover',
    })
    expect(calls('accounts.spotify.com')).toHaveLength(0)
    expect(calls('api.spotify.com')).toHaveLength(0)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`https://open.spotify.com/embed/show/${SHOW}`)
  })

  it('shows the next newest episode once Spotify has a new one', async () => {
    let id = ids[0]!
    route(
      spotify({
        embed: () => new Response(embedHtml(id, id === ids[0] ? 'Old' : 'New'), { status: 200 }),
      }),
    )
    expect((await getShowFeed(LINK, 5)).episodes[0]!.title).toBe('Old')
    id = ids[1]!
    expect((await getShowFeed(LINK, 5)).episodes[0]!.title).toBe('New')
  })
})

describe('when Spotify cannot be reached', () => {
  it('keeps showing the last list that worked', async () => {
    withKeys()
    route(spotify())
    expect((await getShowFeed(LINK, 5)).episodes).toHaveLength(3)
    route(() => new Response('down', { status: 503 }))
    const kept = await getShowFeed(LINK, 5)
    expect(kept.episodes).toHaveLength(3)
    expect(kept.show?.name).toBe('Dialogue Media')
    fetchMock.mockRejectedValue(new Error('network down'))
    expect((await getShowFeed(LINK, 2)).episodes).toHaveLength(2)
  })

  it('is empty (so the section just shows its other audio) when it never worked', async () => {
    route(() => new Response('down', { status: 503 }))
    expect(await getShowFeed(LINK, 5)).toEqual({ show: null, episodes: [] })
    route(() => new Response('<html>no data</html>', { status: 200 }))
    expect(await getShowFeed(LINK, 5)).toEqual({ show: null, episodes: [] })
  })
})

describe('a link that is not a show', () => {
  it.each([
    null,
    '',
    `https://open.spotify.com/episode/${ids[0]}`,
    `https://open.spotify.com/playlist/${SHOW}`,
    'https://evil.example/show/' + SHOW,
  ])('never asks Spotify anything for %j', async (link) => {
    withKeys()
    expect(await getShowFeed(link, 5)).toEqual({ show: null, episodes: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the show behind the homepage Audios section', () => {
  const shelf = (over: Record<string, unknown> = {}) => ({
    blockType: 'mediaShelf',
    format: 'audio',
    spotifyUrl: LINK,
    ...over,
  })

  it('is the show link set on the first visible Audios section, wherever it sits', async () => {
    home.state = { layout: [{ blockType: 'categoryList' }], sidebar: [shelf()] }
    expect(await audioShowLink()).toBe(LINK)
  })

  it('skips hidden sections, other formats, and links that are not a show', async () => {
    home.state = {
      layout: [
        shelf({ hidden: true }),
        shelf({ format: 'video' }),
        shelf({ spotifyUrl: `https://open.spotify.com/episode/${ids[0]}` }),
        shelf({ spotifyUrl: null }),
      ],
      sidebar: [],
    }
    expect(await audioShowLink()).toBeNull()
  })

  it('is null on a homepage with no sections at all', async () => {
    expect(await audioShowLink()).toBeNull()
  })
})

describe('an episode link added by hand', () => {
  const link = `https://open.spotify.com/episode/${ids[1]}?si=abc`

  it('is read from the episode’s own embed page: title, date, length and picture', async () => {
    route((url) =>
      url.includes(`/embed/episode/${ids[1]}`)
        ? new Response(embedHtml(ids[1]!, 'Second one'), { status: 200 })
        : new Response('?', { status: 404 }),
    )
    expect(await getEpisode(link)).toMatchObject({
      id: ids[1],
      title: 'Second one',
      date: '2026-10-17',
      durationSec: 158,
      image: 'https://i.scdn.co/image/embed-cover',
      url: `https://open.spotify.com/episode/${ids[1]}`,
    })
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      `https://open.spotify.com/embed/episode/${ids[1]}`,
    )
  })

  it('keeps the last details when Spotify cannot be reached, and has none when it never could', async () => {
    route(() => new Response(embedHtml(ids[1]!, 'Second one'), { status: 200 }))
    expect((await getEpisode(link))?.title).toBe('Second one')
    route(() => new Response('down', { status: 503 }))
    expect((await getEpisode(link))?.title).toBe('Second one')
    expect(await getEpisode(`https://open.spotify.com/episode/${ids[2]}`)).toBeNull()
  })

  it('is nothing when the page is about a different episode', async () => {
    route(() => new Response(embedHtml(ids[2]!, 'Other'), { status: 200 }))
    expect(await getEpisode(link)).toBeNull()
  })

  it.each([null, '', `https://open.spotify.com/show/${SHOW}`, 'https://evil.example/episode/x'])(
    'never asks Spotify anything for %j',
    async (value) => {
      expect(await getEpisode(value)).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
