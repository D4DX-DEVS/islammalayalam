import { describe, expect, it } from 'vitest'
import { timeAgo } from '@/lib/format'
import { parsePreviewTarget, previewTargetFor, previewUrl, safeLocalPath } from '@/lib/preview'

const ID = '65f1c2a9e4b0a1b2c3d4e5f6'

describe('preview targets', () => {
  it('only previews posts, pages (by object id) and the homepage', () => {
    expect(previewTargetFor({ collection: 'posts', id: ID })).toEqual({
      kind: 'collection',
      collection: 'posts',
      id: ID,
    })
    expect(previewTargetFor({ global: 'homepage' })).toEqual({ kind: 'global', global: 'homepage' })
    for (const bad of [
      { collection: 'users', id: ID },
      { collection: 'audit-logs', id: ID },
      { collection: 'posts', id: 'not-an-id' },
      { collection: 'posts', id: `${ID}/../x` },
      { collection: 'posts' },
      { global: 'site-settings' },
    ])
      expect(previewTargetFor(bad)).toBeNull()
  })

  it('round-trips through an absolute preview URL on the site origin', () => {
    const url = new URL(
      previewUrl('http://localhost:3444/', { kind: 'collection', collection: 'pages', id: ID }),
    )
    expect(url.origin).toBe('http://localhost:3444')
    expect(url.pathname).toBe('/next/preview/')
    expect(parsePreviewTarget(url.searchParams)).toEqual({
      kind: 'collection',
      collection: 'pages',
      id: ID,
    })
    const home = new URL(previewUrl('https://example.org', { kind: 'global', global: 'homepage' }))
    expect(parsePreviewTarget(home.searchParams)).toEqual({ kind: 'global', global: 'homepage' })
  })

  it('never accepts a URL or path in the query string', () => {
    for (const qs of [
      'path=/1/',
      'url=https://attacker.invalid',
      'collection=posts&id=//attacker.invalid',
      '',
    ])
      expect(parsePreviewTarget(new URLSearchParams(qs))).toBeNull()
  })
})

describe('safeLocalPath (exit-preview return address)', () => {
  it('keeps plain site paths, percent-encoded', () => {
    expect(safeLocalPath('/123/')).toBe('/123/')
    expect(safeLocalPath('/category/ഖുർആൻ/')).toBe(
      '/category/%E0%B4%96%E0%B5%81%E0%B5%BC%E0%B4%86%E0%B5%BB/',
    )
    expect(safeLocalPath('/a/?x=1#y')).toBe('/a/')
  })

  it('sends everything else home', () => {
    for (const raw of [
      null,
      '',
      'https://attacker.invalid/',
      '//attacker.invalid/',
      '/.//attacker.invalid',
      '/%2e//attacker.invalid',
      '/a/..//attacker.invalid',
      '/..//attacker.invalid',
      '/./..//attacker.invalid/x',
      '/\\attacker.invalid',
      '\\\\attacker.invalid',
      'javascript:alert(1)',
      '/a\nb',
      '/a\tb',
      `/${'x'.repeat(600)}`,
    ])
      expect(safeLocalPath(raw)).toBe('/')
  })
})

describe('timeAgo', () => {
  const now = Date.UTC(2026, 8, 30, 12, 0, 0)
  it('describes recent edits in plain English', () => {
    expect(timeAgo(new Date(now - 20_000).toISOString(), now)).toBe('just now')
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 minutes ago')
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3 hours ago')
    expect(timeAgo(new Date(now - 86_400_000).toISOString(), now)).toBe('yesterday')
  })
  it('is empty for missing or invalid dates', () => {
    expect(timeAgo(null, now)).toBe('')
    expect(timeAgo('not a date', now)).toBe('')
  })
})
