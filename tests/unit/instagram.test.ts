import { describe, expect, it } from 'vitest'
import {
  chooseToken,
  cleanCaption,
  mediaEndpoint,
  parseMedia,
  refreshEndpoint,
  RENEW_AFTER_MS,
} from '@/lib/instagram'

const IMG = 'https://scontent-bom1-1.cdninstagram.com/v/t51/123_n.jpg?stp=dst-jpg&oe=6720'
const post = (over: Record<string, unknown>) => ({
  id: '17900000000000001',
  caption: 'ധാർമികത\n\n#islam #malayalam',
  media_type: 'IMAGE',
  media_url: IMG,
  permalink: 'https://www.instagram.com/p/Cabc123/',
  timestamp: '2026-10-20T08:15:00+0000',
  ...over,
})

describe('instagram endpoints', () => {
  it('asks the versioned Graph API for the fields it needs, with a sane limit', () => {
    const url = new URL(mediaEndpoint('TOKEN', 500))
    expect(url.origin + url.pathname).toBe('https://graph.instagram.com/v23.0/me/media')
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.get('fields')).toContain('children{media_type,media_url}')
    expect(url.searchParams.get('access_token')).toBe('TOKEN')
  })

  it('refreshes a long-lived token', () => {
    const url = new URL(refreshEndpoint('TOKEN'))
    expect(url.pathname).toBe('/refresh_access_token')
    expect(url.searchParams.get('grant_type')).toBe('ig_refresh_token')
  })
})

describe('parseMedia', () => {
  it('keeps picture posts and a carousel’s first image, newest first, and skips videos', () => {
    const posts = parseMedia({
      data: [
        post({}),
        post({ id: '17900000000000002', media_type: 'VIDEO' }),
        post({
          id: '17900000000000003',
          media_type: 'CAROUSEL_ALBUM',
          media_url: undefined,
          children: {
            data: [
              { media_type: 'VIDEO', media_url: IMG.replace('123', '999') },
              { media_type: 'IMAGE', media_url: IMG.replace('123', '456') },
            ],
          },
        }),
        post({ id: '17900000000000004', media_type: 'CAROUSEL_ALBUM', children: { data: [] } }),
      ],
    })
    expect(posts.map((p) => p.id)).toEqual(['17900000000000001', '17900000000000003'])
    expect(posts[1]?.image).toContain('456_n.jpg')
    expect(posts[0]).toMatchObject({
      caption: 'ധാർമികത',
      permalink: 'https://www.instagram.com/p/Cabc123/',
      timestamp: '2026-10-20T08:15:00.000Z',
    })
  })

  it('ignores pictures and links that are not Instagram’s own', () => {
    expect(parseMedia({ data: [post({ media_url: 'https://evil.example/x.jpg' })] })).toEqual([])
    expect(parseMedia({ data: [post({ media_url: IMG.replace('https', 'http') })] })).toEqual([])
    expect(parseMedia({ data: [post({ permalink: 'https://evil.example/p/1/' })] })).toEqual([])
    expect(parseMedia({ data: [post({ id: '../me' })] })).toEqual([])
    expect(parseMedia({ error: { message: 'expired' } })).toEqual([])
    expect(parseMedia(null)).toEqual([])
  })
})

describe('cleanCaption', () => {
  it('drops hashtag-only lines and keeps the words', () => {
    expect(cleanCaption('Line one\n#a #b\n@dialogue_media\n\n\n\nLine two')).toBe(
      'Line one\n\nLine two',
    )
    expect(cleanCaption(undefined)).toBe('')
    expect(cleanCaption('x'.repeat(700))).toHaveLength(600)
  })
})

describe('chooseToken', () => {
  const now = Date.parse('2026-10-29T00:00:00Z')
  const day = 24 * 60 * 60 * 1000
  const stored = (over: object) => ({
    token: 'STORED',
    sourceHash: 'H1',
    refreshedAt: new Date(now - day).toISOString(),
    ...over,
  })

  it('uses a fresh stored token that came from this env token, with the env one as fallback', () => {
    expect(chooseToken(stored({}), 'ENV', 'H1', now)).toEqual({
      token: 'STORED',
      renew: false,
      fallback: 'ENV',
    })
  })

  it('renews the stored token once it is a week old', () => {
    const old = stored({ refreshedAt: new Date(now - RENEW_AFTER_MS).toISOString() })
    expect(chooseToken(old, 'ENV', 'H1', now).renew).toBe(true)
  })

  it('ignores a stored token from another env token (variable replaced, or another environment)', () => {
    expect(chooseToken(stored({ sourceHash: 'H2' }), 'ENV', 'H1', now)).toEqual({
      token: 'ENV',
      renew: true,
      fallback: null,
    })
    expect(chooseToken({}, 'ENV', 'H1', now).token).toBe('ENV')
  })
})
