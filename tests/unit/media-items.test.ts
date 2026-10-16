import { describe, expect, it } from 'vitest'
import { displayTitle, hasAnyField, itemLabel, linkHost, mergeFirst } from '@/lib/media-items'
import { validateOptionalHttps, validateYouTubeLink } from '@/payload/fields'

const check = (fn: unknown, value: unknown) =>
  (fn as (v: unknown, o: unknown) => true | string)(value, {} as never)

describe('linkHost', () => {
  it('names the site a web link points to', () => {
    expect(linkHost('https://open.spotify.com/episode/abc')).toBe('open.spotify.com')
    expect(linkHost('  https://www.youtube.com/watch?v=x  ')).toBe('youtube.com')
  })

  it('is null for anything that is not a web address', () => {
    for (const bad of [null, undefined, '', 'not a link', 'javascript:alert(1)', 'mailto:a@b.c'])
      expect(linkHost(bad)).toBeNull()
  })
})

describe('itemLabel (the name in the admin list)', () => {
  it('prefers the title, then the author, then the link host, then the kind', () => {
    expect(
      itemLabel({ title: 'Faith', author: 'Dr X', link: 'https://a.example/x' }, 'audio'),
    ).toBe('Faith')
    expect(itemLabel({ author: 'Dr X', link: 'https://a.example/x' }, 'audio')).toBe('Dr X')
    expect(itemLabel({ link: 'https://www.a.example/x' }, 'video')).toBe('a.example')
    expect(itemLabel({}, 'audio')).toBe('Audio')
    expect(itemLabel({ title: '  ', author: null, link: '' }, 'video')).toBe('Video')
  })

  it('collapses whitespace and shortens a very long title', () => {
    expect(itemLabel({ title: '  A   B\n C ' }, 'audio')).toBe('A B C')
    const long = itemLabel({ title: 'x'.repeat(200) }, 'audio')
    expect(long).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('displayTitle (what visitors see)', () => {
  it('uses the typed title first, then what the link reports', () => {
    expect(displayTitle({ title: 'Mine' }, 'video', 'From YouTube')).toBe('Mine')
    expect(displayTitle({}, 'video', 'From YouTube')).toBe('From YouTube')
    expect(displayTitle({ title: ' ' }, 'video', '  From YouTube ')).toBe('From YouTube')
  })

  it('falls back to the author, the link host, then the kind', () => {
    expect(displayTitle({ author: 'Dr X' }, 'audio', null)).toBe('Dr X')
    expect(displayTitle({ link: 'https://open.spotify.com/show/1' }, 'audio')).toBe(
      'open.spotify.com',
    )
    expect(displayTitle({}, 'audio', '')).toBe('Audio')
  })
})

describe('hasAnyField', () => {
  it('is false only when everything is empty', () => {
    expect(hasAnyField({})).toBe(false)
    expect(hasAnyField({ link: ' ', title: '', author: null })).toBe(false)
    expect(hasAnyField({ link: 'https://x.example' })).toBe(true)
    expect(hasAnyField({ title: 'T' })).toBe(true)
    expect(hasAnyField({ author: 'A' })).toBe(true)
  })
})

describe('mergeFirst', () => {
  it('puts entries before posts and never exceeds the limit', () => {
    expect(mergeFirst(['e1', 'e2'], ['p1', 'p2', 'p3'], 4)).toEqual(['e1', 'e2', 'p1', 'p2'])
    expect(mergeFirst(['e1', 'e2', 'e3'], ['p1'], 2)).toEqual(['e1', 'e2'])
    expect(mergeFirst([], ['p1'], 5)).toEqual(['p1'])
    expect(mergeFirst(['e1'], ['p1'], 0)).toEqual([])
    expect(mergeFirst(['e1'], ['p1'], -3)).toEqual([])
  })
})

describe('link validators (every link is optional)', () => {
  it('accept empty values', () => {
    for (const empty of [undefined, null, ''])
      expect([check(validateOptionalHttps, empty), check(validateYouTubeLink, empty)]).toEqual([
        true,
        true,
      ])
  })

  it('audio link: https only', () => {
    expect(
      check(validateOptionalHttps, 'https://open.spotify.com/episode/0Q86acNRm6V9GYx55SXKwf'),
    ).toBe(true)
    expect(check(validateOptionalHttps, 'https://cdn.example/audio.mp3')).toBe(true)
    for (const bad of [
      'http://insecure.example/a.mp3',
      'javascript:alert(1)',
      'ftp://x/y',
      'just words',
    ])
      expect(check(validateOptionalHttps, bad)).toEqual(expect.stringMatching(/https/))
  })

  it('video link: YouTube only', () => {
    expect(check(validateYouTubeLink, 'https://www.youtube.com/watch?v=fvRsB9zkoxM')).toBe(true)
    expect(check(validateYouTubeLink, 'https://youtu.be/fvRsB9zkoxM')).toBe(true)
    for (const bad of ['https://vimeo.com/123', 'https://example.org/watch?v=fvRsB9zkoxM', 'nope'])
      expect(check(validateYouTubeLink, bad)).toEqual(expect.stringMatching(/YouTube/))
  })
})
