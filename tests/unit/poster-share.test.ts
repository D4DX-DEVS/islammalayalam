import { describe, expect, it } from 'vitest'
import { embedUri } from '@/components/home/audio/spotify-embed'
import { PUBLIC_DOMAIN, pasteKeys, siteAddress } from '@/lib/poster-share'
import { shareLinks } from '@/lib/share-links'

describe('siteAddress', () => {
  it('is the public host of the address, the line printed under a shared poster', () => {
    expect(siteAddress('https://islammalayalam.net/quote/65f1c2a9e4b0a1b2c3d4e5f6/')).toBe(
      'islammalayalam.net',
    )
    expect(siteAddress('https://www.islammalayalam.net/')).toBe('islammalayalam.net')
    expect(siteAddress('https://staging.example.org/quote/abc/')).toBe('staging.example.org')
  })
  it('is islammalayalam.net on a development address, never localhost or an IP', () => {
    for (const url of [
      'http://localhost:3444/quote/abc/',
      'http://127.0.0.1:3444/',
      'http://192.168.1.20:3444/quote/abc/',
      'http://my-mac:3444/',
      'not a url',
    ])
      expect(siteAddress(url)).toBe(PUBLIC_DOMAIN)
    expect(PUBLIC_DOMAIN).toBe('islammalayalam.net')
  })
})

describe('pasteKeys', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '⌘ + V'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', '⌘ + V'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Ctrl + V'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', 'Ctrl + V'],
  ])('%s → %s', (agent, keys) => expect(pasteKeys(agent)).toBe(keys))
})

describe('embedUri', () => {
  const ID = '3JTKn7MwgvUzXwK4p9Aayw'
  it.each(['episode', 'track', 'show', 'playlist', 'album', 'artist'])(
    'turns a %s embed address into its Spotify URI',
    (type) =>
      expect(embedUri(`https://open.spotify.com/embed/${type}/${ID}`)).toBe(
        `spotify:${type}:${ID}`,
      ),
  )
  it.each([
    null,
    undefined,
    '',
    `https://open.spotify.com/episode/${ID}`,
    `https://open.spotify.com/embed/episode/${ID}?utm_source=x`,
    `http://open.spotify.com/embed/episode/${ID}`,
    `https://evil.example/embed/episode/${ID}`,
    'https://open.spotify.com/embed/episode/short',
    `https://open.spotify.com/embed/user/${ID}`,
  ])('gives nothing for %j', (src) => expect(embedUri(src)).toBeNull())
})

describe('shareLinks', () => {
  const enc = encodeURIComponent
  it('carries just the address when it is all that is shared (a poster, or the site itself)', () => {
    expect(shareLinks('https://islammalayalam.net')).toEqual({
      whatsapp: `https://wa.me/?text=${enc('https://islammalayalam.net')}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc('https://islammalayalam.net')}`,
      x: `https://twitter.com/intent/tweet?url=${enc('https://islammalayalam.net')}`,
      telegram: `https://t.me/share/url?url=${enc('https://islammalayalam.net')}`,
    })
  })
  it('puts the words with it when there are some', () => {
    const links = shareLinks('https://islammalayalam.net/quote/1/', 'A quote — Source')
    expect(links.whatsapp).toBe(
      `https://wa.me/?text=${enc('A quote — Source\nhttps://islammalayalam.net/quote/1/')}`,
    )
    expect(links.x).toContain(`&text=${enc('A quote — Source')}`)
    expect(links.facebook).toContain(`&quote=${enc('A quote — Source')}`)
    expect(links.telegram).toContain(`&text=${enc('A quote — Source')}`)
  })
})
