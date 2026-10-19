import { describe, expect, it } from 'vitest'
import { resolveLink } from '@/lib/links'
import { isActive, isCurrent, toNavTree } from '@/lib/nav'
import { quoteIndexForDate } from '@/lib/quote'
import { formatDate, parsePage, withoutSiteName } from '@/lib/format'
import { mediaSrc } from '@/lib/media'
import { pageWindow } from '@/lib/pagination'

describe('resolveLink', () => {
  it('resolves references to canonical URLs', () => {
    expect(
      resolveLink({
        type: 'reference',
        label: 'P',
        reference: { relationTo: 'posts', value: { id: '1', postNumber: 4306 } as never },
      })?.href,
    ).toBe('/4306/')
    expect(
      resolveLink({
        type: 'reference',
        label: 'K',
        reference: { relationTo: 'pages', value: { id: '1', path: 'ആദർശം/വിശ്വാസം' } as never },
      })?.href,
    ).toBe('/ആദർശം/വിശ്വാസം/')
    expect(
      resolveLink({
        type: 'reference',
        label: 'C',
        reference: { relationTo: 'categories', value: { id: '1', slug: 'news' } as never },
      })?.href,
    ).toBe('/category/news/')
  })

  it('never emits unsafe or unresolved hrefs', () => {
    expect(resolveLink({ type: 'custom', label: 'x', url: 'javascript:alert(1)' })?.href).toBeNull()
    expect(
      resolveLink({
        type: 'reference',
        label: 'x',
        reference: { relationTo: 'pages', value: 'unpopulated-id' },
      })?.href,
    ).toBeNull()
    expect(resolveLink({ type: 'none', label: 'Group' })).toEqual({
      label: 'Group',
      href: null,
      newTab: false,
      external: false,
    })
    expect(resolveLink({ type: 'custom', label: '', url: '/x/' })).toBeNull()
    expect(
      resolveLink({ type: 'custom', label: 'ext', url: 'https://example.org' })?.external,
    ).toBe(true)
  })
})

describe('navigation state', () => {
  const tree = toNavTree([
    { link: { type: 'custom', label: 'Home', url: '/' } },
    {
      link: { type: 'none', label: 'ഖുര്‍ആന്‍' },
      children: [{ link: { type: 'custom', label: 'A', url: '/ആദർശം/' } }],
    },
  ])
  it('marks ancestors active and the exact page current, comparing decoded paths', () => {
    const encoded = `/${encodeURIComponent('ആദർശം')}/${encodeURIComponent('വിശ്വാസം')}/`
    expect(isActive(tree[1]!, encoded)).toBe(true)
    expect(isActive(tree[0]!, encoded)).toBe(false)
    expect(isActive(tree[0]!, '/')).toBe(true)
    expect(isCurrent(tree[1]!.children[0]!, `/${encodeURIComponent('ആദർശം')}/`)).toBe(true)
  })
})

describe('header highlight links', () => {
  it('carries the highlight flag only where an editor set it', () => {
    const [plain, button] = toNavTree([
      { link: { type: 'custom', label: 'About', url: '/about/' } },
      { link: { type: 'custom', label: 'Postal Library', url: '/library/' }, highlight: true },
    ])
    expect(plain!.highlight).toBe(false)
    expect(button!.highlight).toBe(true)
  })
})

describe('quote of the day', () => {
  it('is stable for an India day and moves on at IST midnight', () => {
    const lateEvening = new Date('2026-10-12T18:20:00Z') // 23:50 IST, 12 Oct
    const sameDay = new Date('2026-10-11T19:00:00Z') // 00:30 IST, 12 Oct
    const nextDay = new Date('2026-10-12T18:40:00Z') // 00:10 IST, 13 Oct
    expect(quoteIndexForDate(7, lateEvening)).toBe(quoteIndexForDate(7, sameDay))
    expect(quoteIndexForDate(7, nextDay)).toBe((quoteIndexForDate(7, sameDay) + 1) % 7)
  })
  it('cycles through every quote and handles empty lists', () => {
    const seen = new Set<number>()
    for (let d = 0; d < 5; d++)
      seen.add(quoteIndexForDate(5, new Date(Date.UTC(2026, 0, 1 + d, 6))))
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4])
    expect(quoteIndexForDate(0)).toBe(-1)
    expect(quoteIndexForDate(1)).toBe(0)
  })
})

describe('helpers', () => {
  it('parses ?page defensively', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage(['2', '9'])).toBe(2)
    for (const bad of [undefined, '0', '-1', 'abc', '1e3', '99999999', '2.5'])
      expect(parsePage(bad)).toBe(1)
  })

  it('formats dates like the original site (Asia/Kolkata)', () => {
    expect(formatDate('2022-04-25T20:00:00.000Z')).toBe('26 April 2022') // India time: already the 26th
    expect(formatDate('not a date')).toBe('')
    expect(formatDate(null)).toBe('')
  })

  it('drops the site name from the copyright line (the logo already says it)', () => {
    const names = ['Islam Malayalam', 'ഇസ്‌ലാം മലയാളം']
    expect(withoutSiteName('© Islam Malayalam. All rights reserved.', names)).toBe(
      '© All rights reserved.',
    )
    expect(withoutSiteName('© 2026 islam malayalam, all rights reserved', names)).toBe(
      '© 2026, all rights reserved',
    )
    expect(withoutSiteName('© ഇസ്‌ലാം മലയാളം. എല്ലാ അവകാശങ്ങളും', names)).toBe(
      '© എല്ലാ അവകാശങ്ങളും',
    )
    // Nothing to remove, or nothing given: unchanged / empty.
    expect(withoutSiteName('© All rights reserved.', names)).toBe('© All rights reserved.')
    expect(withoutSiteName(undefined, names)).toBe('')
    expect(withoutSiteName('© Acme.', [null, '', '  '])).toBe('© Acme.')
  })

  it('makes local media URLs relative whatever origin built them, and drops insecure remotes', () => {
    expect(mediaSrc('http://localhost:3000/api/media/file/a.webp')).toBe('/api/media/file/a.webp')
    expect(mediaSrc('/api/media/file/a.webp')).toBe('/api/media/file/a.webp')
    expect(mediaSrc('https://cdn.example/media/a.webp')).toBe('https://cdn.example/media/a.webp')
    expect(mediaSrc('http://attacker.invalid/a.webp')).toBeNull()
  })

  it('builds a compact pagination window', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
  })
})
