import { describe, expect, it } from 'vitest'
import { parseServerEnv } from '@/lib/env'
import {
  clock,
  minutes,
  parseApiEpisodes,
  parseApiShow,
  parseEmbed,
  spotifyEpisodeId,
  spotifyShowId,
} from '@/lib/spotify-show'

const SHOW = '033wtcM4m46cI7qpurWrMC'
const EP1 = '3JTKn7MwgvUzXwK4p9Aayw'
const EP2 = '0Q86acNRm6V9GYx55SXKwf'

describe('spotifyShowId', () => {
  it.each([
    `https://open.spotify.com/show/${SHOW}`,
    `https://open.spotify.com/show/${SHOW}?si=-VOL8EArRUepyTZlfR7NPQ&nd=1&dlsi=1ee4217a77dd40ac`,
    `  https://open.spotify.com/show/${SHOW}  `,
    `https://open.spotify.com/intl-in/show/${SHOW}`,
    `spotify:show:${SHOW}`,
  ])('finds the show in %s', (link) => expect(spotifyShowId(link)).toBe(SHOW))

  it.each([
    '',
    null,
    undefined,
    `https://open.spotify.com/episode/${EP1}`,
    `https://open.spotify.com/playlist/${SHOW}`,
    `http://open.spotify.com/show/${SHOW}`,
    `https://evil.example/show/${SHOW}`,
    `https://open.spotify.com.evil.example/show/${SHOW}`,
    'https://open.spotify.com/show/short',
    `https://open.spotify.com/show/${SHOW}x`,
    'not a link',
  ])('finds no show in %j', (link) => expect(spotifyShowId(link)).toBeNull())
})

describe('spotifyEpisodeId', () => {
  it('finds the episode in a link, and not a show', () => {
    expect(spotifyEpisodeId(`https://open.spotify.com/episode/${EP1}?si=abc`)).toBe(EP1)
    expect(spotifyEpisodeId(`spotify:episode:${EP2}`)).toBe(EP2)
    expect(spotifyEpisodeId(`https://open.spotify.com/show/${SHOW}`)).toBeNull()
    expect(spotifyEpisodeId('')).toBeNull()
  })
})

describe('clock', () => {
  it.each([
    [158, '2:38'],
    [59, '0:59'],
    [3723, '1:02:03'],
    [600, '10:00'],
    [158.6, '2:39'],
  ])('%s s → %s', (seconds, text) => expect(clock(seconds)).toBe(text))
  it.each([null, undefined, 0, -5, NaN])('has no clock for %s', (v) =>
    expect(clock(v as never)).toBeNull(),
  )
})

describe('minutes', () => {
  it.each([
    [158, '3 min'],
    [3600, '60 min'],
    [20, '1 min'],
    [1, '1 min'],
  ])('%s s → %s', (seconds, text) => expect(minutes(seconds)).toBe(text))
  it.each([null, undefined, 0, -5, NaN])('has no length for %s', (v) =>
    expect(minutes(v as never)).toBeNull(),
  )
})

const api = (items: unknown[]) => ({ href: 'x', limit: 50, total: items.length, items })
const item = (over: Record<string, unknown> = {}) => ({
  id: EP1,
  name: ' യഥാര്‍ത്ഥ സമാധാനം തേടി ',
  description: 'A talk',
  release_date: '2026-10-17',
  release_date_precision: 'day',
  duration_ms: 158081,
  is_playable: true,
  images: [
    { url: 'https://i.scdn.co/image/aaa640', height: 640, width: 640 },
    { url: 'https://i.scdn.co/image/aaa300', height: 300, width: 300 },
    { url: 'https://i.scdn.co/image/aaa64', height: 64, width: 64 },
  ],
  external_urls: { spotify: `https://open.spotify.com/episode/${EP1}` },
  ...over,
})

describe('parseApiEpisodes', () => {
  it('turns the Web API answer into episodes, newest first as given', () => {
    const episodes = parseApiEpisodes(
      api([item(), item({ id: EP2, name: 'Second', release_date: '2026-10-10' })]),
    )
    expect(episodes).toHaveLength(2)
    expect(episodes[0]).toEqual({
      id: EP1,
      title: 'യഥാര്‍ത്ഥ സമാധാനം തേടി',
      description: 'A talk',
      date: '2026-10-17',
      durationSec: 158,
      image: 'https://i.scdn.co/image/aaa640',
      url: `https://open.spotify.com/episode/${EP1}`,
    })
    expect(episodes[1]!.id).toBe(EP2)
  })

  it('takes the biggest picture whatever order they come in', () => {
    const small = item({
      images: [
        { url: 'https://i.scdn.co/image/s', width: 64 },
        { url: 'https://i.scdn.co/image/b', width: 640 },
      ],
    })
    expect(parseApiEpisodes(api([small]))[0]!.image).toBe('https://i.scdn.co/image/b')
  })

  it.each([
    ['https://i.scdn.co/image/abc', true],
    ['https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f', true],
    ['https://image-cdn-ak.spotifycdn.com/image/abc', true],
    ['http://i.scdn.co/image/abc', false],
    ['https://i.scdn.co/other/abc', false],
    ['https://evil.example/image/abc', false],
    ['https://i.scdn.co.evil.example/image/abc', false],
    ['https://spotifycdn.com.evil.example/image/abc', false],
    ['not a url', false],
  ])('uses a cover from %s: %s', (url, ok) => {
    const [episode] = parseApiEpisodes(api([item({ images: [{ url, width: 640 }] })]))
    expect(episode!.image).toBe(ok ? url : null)
  })

  it('copes with a missing date, length or picture', () => {
    const [episode] = parseApiEpisodes(
      api([item({ release_date: undefined, duration_ms: 0, images: [] })]),
    )
    expect(episode).toMatchObject({ date: null, durationSec: null, image: null })
  })

  it('keeps the year-only and month-only dates Spotify sometimes gives usable', () => {
    expect(parseApiEpisodes(api([item({ release_date: '2026-10' })]))[0]!.date).toBeNull()
    expect(parseApiEpisodes(api([item({ release_date: '2026-10-17T05:00:00Z' })]))[0]!.date).toBe(
      '2026-10-17',
    )
  })

  it('skips nulls, repeats, unplayable episodes, bad ids, nameless ones and non-https pictures', () => {
    const episodes = parseApiEpisodes(
      api([
        null,
        item({ id: EP1 }),
        item({ id: EP1, name: 'again' }),
        item({ id: EP2, is_playable: false }),
        item({ id: 'short' }),
        item({ id: '1234567890123456789012', name: '   ' }),
        item({
          id: 'ABCDEFGHIJKLMNOPQRSTUV',
          images: [{ url: 'http://i.scdn.co/image/x', width: 64 }],
        }),
      ]),
    )
    expect(episodes.map((e) => e.id)).toEqual([EP1, 'ABCDEFGHIJKLMNOPQRSTUV'])
    expect(episodes[1]!.image).toBeNull()
  })

  it.each([null, undefined, {}, [], 'text', { items: 'nope' }, { items: [] }])(
    'gives nothing for %j',
    (v) => expect(parseApiEpisodes(v)).toEqual([]),
  )
})

// The shape of the real embed page of a show: its data names the newest episode.
const embed = (entity: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity } } } },
  })}</script></html>`
const entity = (over: Record<string, unknown> = {}) => ({
  type: 'episode',
  name: 'യഥാര്‍ത്ഥ സമാധാനം തേടി ഇസ്‌ലാമിലേക്ക്',
  id: EP1,
  title: 'യഥാര്‍ത്ഥ സമാധാനം തേടി ഇസ്‌ലാമിലേക്ക്',
  subtitle: 'Dialogue Media',
  relatedEntityUri: `spotify:show:${SHOW}`,
  releaseDate: { isoString: '2026-10-17T10:05:00Z' },
  duration: 158081,
  relatedEntityCoverArt: [
    { url: 'https://i.scdn.co/image/small', width: 64, height: 64 },
    { url: 'https://i.scdn.co/image/large', width: 640, height: 640 },
  ],
  ...over,
})

describe('parseApiShow', () => {
  const show = (over: Record<string, unknown> = {}) => ({
    id: SHOW,
    name: ' Dialogue Media ',
    publisher: ' Dialogue Media Team ',
    total_episodes: 42,
    images: [
      { url: 'https://i.scdn.co/image/s', width: 64 },
      { url: 'https://i.scdn.co/image/b', width: 640 },
    ],
    ...over,
  })

  it('reads the show’s name, publisher, biggest cover and size', () => {
    expect(parseApiShow(show())).toEqual({
      id: SHOW,
      name: 'Dialogue Media',
      publisher: 'Dialogue Media Team',
      image: 'https://i.scdn.co/image/b',
      url: `https://open.spotify.com/show/${SHOW}`,
      total: 42,
    })
  })

  it('copes with no publisher, size or cover', () => {
    expect(
      parseApiShow(show({ publisher: '', total_episodes: undefined, images: [] })),
    ).toMatchObject({ publisher: null, total: null, image: null })
  })

  it.each([null, undefined, 'text', [], {}, show({ id: 'short' }), show({ name: '  ' })])(
    'gives nothing for %j',
    (v) => expect(parseApiShow(v)).toBeNull(),
  )
})

describe('parseEmbed', () => {
  it('reads the newest episode and the show from the show embed page', () => {
    expect(parseEmbed(embed(entity()))).toEqual({
      episode: {
        id: EP1,
        title: 'യഥാര്‍ത്ഥ സമാധാനം തേടി ഇസ്‌ലാമിലേക്ക്',
        description: '',
        date: '2026-10-17',
        durationSec: 158,
        image: 'https://i.scdn.co/image/large',
        url: `https://open.spotify.com/episode/${EP1}`,
      },
      show: {
        id: SHOW,
        name: 'Dialogue Media',
        publisher: null,
        image: 'https://i.scdn.co/image/large',
        url: `https://open.spotify.com/show/${SHOW}`,
        total: null,
      },
    })
  })

  it('takes the last picture when the page gives no sizes (it lists them smallest first)', () => {
    const cover = [
      { url: 'https://i.scdn.co/image/small' },
      { url: 'https://i.scdn.co/image/middle' },
      { url: 'https://i.scdn.co/image/large' },
    ]
    expect(parseEmbed(embed(entity({ relatedEntityCoverArt: cover })))!.episode.image).toBe(
      'https://i.scdn.co/image/large',
    )
  })

  it('prefers the episode’s own thumbnail to the show’s cover', () => {
    const video = [{ url: 'https://image-cdn-fa.spotifycdn.com/image/thumb', width: 640 }]
    const parsed = parseEmbed(embed(entity({ videoThumbnailImage: video })))!
    expect(parsed.episode.image).toBe('https://image-cdn-fa.spotifycdn.com/image/thumb')
    expect(parsed.show!.image).toBe('https://i.scdn.co/image/large')
  })

  it('has no show when the page does not say which one it is', () => {
    expect(parseEmbed(embed(entity({ relatedEntityUri: undefined })))!.show).toBeNull()
    expect(parseEmbed(embed(entity({ subtitle: '' })))!.show).toBeNull()
    expect(parseEmbed(embed(entity({ relatedEntityUri: 'spotify:artist:x' })))!.show).toBeNull()
  })

  it('falls back to the name when there is no title', () => {
    expect(parseEmbed(embed(entity({ title: undefined })))!.episode.title).toContain('സമാധാനം')
  })

  it.each([
    ['a page that is not the embed', '<html>nothing</html>'],
    ['data that is not JSON', '<script id="__NEXT_DATA__" type="application/json">{oops</script>'],
    ['a show instead of an episode', embed(entity({ type: 'show' }))],
    ['an episode with a bad id', embed(entity({ id: 'nope' }))],
    ['an episode with no name', embed(entity({ name: '', title: '' }))],
    ['no entity at all', embed(undefined)],
  ])('gives nothing for %s', (_, html) => expect(parseEmbed(html)).toBeNull())
})

describe('Spotify app keys in the server environment', () => {
  const base = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
    NODE_ENV: 'development',
    PAYLOAD_SECRET: 's'.repeat(40),
  }
  const ID = 'a'.repeat(32)
  it('are optional', () => {
    expect(parseServerEnv(base).SPOTIFY_CLIENT_ID).toBeUndefined()
    expect(
      parseServerEnv({ ...base, SPOTIFY_CLIENT_ID: '', SPOTIFY_CLIENT_SECRET: '' })
        .SPOTIFY_CLIENT_SECRET,
    ).toBeUndefined()
  })
  it('work as a pair', () => {
    const env = parseServerEnv({ ...base, SPOTIFY_CLIENT_ID: ID, SPOTIFY_CLIENT_SECRET: ID })
    expect(env.SPOTIFY_CLIENT_ID).toBe(ID)
  })
  it('refuse one without the other, and a value that is too short', () => {
    expect(() => parseServerEnv({ ...base, SPOTIFY_CLIENT_ID: ID })).toThrow(
      /both SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET/i,
    )
    expect(() => parseServerEnv({ ...base, SPOTIFY_CLIENT_SECRET: ID })).toThrow(
      /both SPOTIFY_CLIENT_ID/i,
    )
    expect(() =>
      parseServerEnv({ ...base, SPOTIFY_CLIENT_ID: 'x', SPOTIFY_CLIENT_SECRET: ID }),
    ).toThrow(/too short/)
  })
})
