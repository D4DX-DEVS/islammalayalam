import { describe, expect, it } from 'vitest'
import { trackAudio } from '@/lib/audio'
import { clock, filterTracks, nextSpeed } from '@/lib/audio-list'
import { spotifyOpenUrl } from '@/lib/security/url'

const SHOW = 'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk'
const EPISODE = 'https://open.spotify.com/episode/0Q86acNRm6V9GYx55SXKwf'

describe('spotifyOpenUrl', () => {
  it('normalises a Spotify share link to its open address', () => {
    expect(spotifyOpenUrl(`${SHOW}?si=abc123`)).toBe(SHOW)
    expect(spotifyOpenUrl('https://open.spotify.com/intl-ml/episode/0Q86acNRm6V9GYx55SXKwf')).toBe(
      EPISODE,
    )
  })

  it('rejects everything that is not Spotify', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'nope',
      'http://open.spotify.com/show/' + 'a'.repeat(22),
      'https://evil.example/show/' + 'a'.repeat(22),
      'https://open.spotify.com/user/xyz',
    ])
      expect(spotifyOpenUrl(bad)).toBeNull()
  })
})

describe('trackAudio', () => {
  it('plays a Spotify field in the embed and links the Spotify button to it', () => {
    const t = trackAudio({ spotifyUrl: EPISODE })
    expect(t.source).toMatchObject({
      kind: 'spotify',
      src: expect.stringContaining('/embed/episode/'),
    })
    expect(t.spotifyLink).toBe(EPISODE)
  })

  it('still understands Spotify typed into the audio link (older posts)', () => {
    const t = trackAudio({ url: SHOW })
    expect(t.source).toMatchObject({ kind: 'spotify', tall: true })
    expect(t.spotifyLink).toBe(SHOW)
  })

  it('lets a hosted file play inline while the Spotify field feeds the button', () => {
    const t = trackAudio({ url: '/api/media/file/talk.mp3', spotifyUrl: EPISODE })
    expect(t.source).toEqual({ kind: 'file', src: '/api/media/file/talk.mp3' })
    expect(t.spotifyLink).toBe(EPISODE)
  })

  it('treats an unplayable link plus a Spotify field as a Spotify track', () => {
    const t = trackAudio({ url: 'https://example.org/page', spotifyUrl: EPISODE })
    expect(t.source.kind).toBe('spotify')
  })

  it('ignores a bad Spotify field and handles missing audio', () => {
    expect(trackAudio({ spotifyUrl: 'https://example.org/x' }).source.kind).toBe('none')
    expect(trackAudio({ spotifyUrl: 'https://example.org/x' }).spotifyLink).toBeNull()
    expect(trackAudio(null)).toEqual({ source: { kind: 'none' }, spotifyLink: null })
  })
})

const tracks = [
  { title: 'കൊളോണിയൽ സാമ്രാജ്യത്വം', subtitle: 'ഡോ. അഹ്മദ്' },
  { title: 'Ammar bin Yasir | Companions', subtitle: 'IslamOnlive' },
  { title: 'ഇമാം അഹ്മദ് ബിൻ ഹമ്പൽ', subtitle: 'IslamOnlive' },
]

describe('filterTracks', () => {
  it('returns every index for an empty query', () => {
    expect(filterTracks(tracks, '')).toEqual([0, 1, 2])
    expect(filterTracks(tracks, '   ')).toEqual([0, 1, 2])
  })

  it('matches words in the title or subtitle, any case', () => {
    expect(filterTracks(tracks, 'ammar')).toEqual([1])
    expect(filterTracks(tracks, 'islamonlive')).toEqual([1, 2])
    expect(filterTracks(tracks, 'YASIR companions')).toEqual([1])
  })

  it('requires every word and works for Malayalam', () => {
    expect(filterTracks(tracks, 'അഹ്മദ്')).toEqual([0, 2])
    expect(filterTracks(tracks, 'അഹ്മദ് ഹമ്പൽ')).toEqual([2])
    expect(filterTracks(tracks, 'അഹ്മദ് zzz')).toEqual([])
  })

  it('ignores invisible joiners in Malayalam text', () => {
    expect(filterTracks([{ title: 'ഇസ്‌ലാം', subtitle: null }], 'ഇസ്ലാം')).toEqual([0])
  })
})

describe('clock and speed', () => {
  it('formats times', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(65.9)).toBe('1:05')
    expect(clock(3723)).toBe('1:02:03')
    expect(clock(Number.NaN)).toBe('0:00')
    expect(clock(-5)).toBe('0:00')
  })

  it('cycles through the speeds and wraps', () => {
    expect(nextSpeed(1)).toBe(1.25)
    expect(nextSpeed(2)).toBe(0.75)
    expect(nextSpeed(0.75)).toBe(1)
    expect(nextSpeed(3)).toBe(1) // an unknown value falls back to normal speed
  })
})
