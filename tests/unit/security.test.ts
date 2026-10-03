import { describe, expect, it } from 'vitest'
import { findIocs, IOC_PATTERNS } from '@/lib/security/ioc'
import { isSafeHref, youtubeId } from '@/lib/security/url'
import { buildCsp } from '@/lib/security/csp'
import { needsTrailingSlash } from '@/lib/routing'

describe('findIocs', () => {
  it('detects the legacy infection markers', () => {
    expect(findIocs("add_action('wp_head', 'xdav_tracker')")).toContain('xdav_hook')
    expect(findIocs('<!-- BEGIN: X Secure Pixel Stream -->')).toContain('pixel_stream')
    expect(findIocs('fetch("https://interseq.at/x")')).toContain('interseq')
    expect(findIocs('0x0C7Cb01C83203aC0a50Abc3a9AFF3c9Ca727eF55')).toContain('polygon_contract')
    expect(findIocs('<SCRIPT src=x>')).toContain('script_tag')
    expect(findIocs('<a href="javascript:alert(1)">')).toContain('js_url')
    expect(findIocs('<?php system($_GET[1]); ?>')).toContain('php_tag')
  })

  it('passes clean Malayalam and English text', () => {
    expect(findIocs('ഇസ്‌ലാം മലയാളം — ഖുര്‍ആന്‍ പഠനം. JavaScript is a language.')).toEqual([])
    expect(findIocs(null)).toEqual([])
  })

  it('pattern ids never match the scanner themselves (reports are re-scanned)', () => {
    for (const { id } of IOC_PATTERNS) expect(findIocs(id)).toEqual([])
  })
})

describe('isSafeHref', () => {
  it.each([
    '/about/',
    '#top',
    'https://example.org',
    'http://example.org',
    'mailto:a@b.c',
    'tel:+914952402451',
  ])('allows %s', (href) => {
    expect(isSafeHref(href)).toBe(true)
  })
  it.each([
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\u0000script:x',
    'data:text/html,<b>',
    'vbscript:x',
    '//attacker.invalid',
    '/\\attacker.invalid',
    '/\t/attacker.invalid/', // browsers drop the tab → //attacker.invalid/
    '/\n\\attacker.invalid',
    'relative/path',
    '',
    42,
  ])('rejects %s', (href) => {
    expect(isSafeHref(href)).toBe(false)
  })
})

describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=3', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://attacker.invalid/watch?v=dQw4w9WgXcQ', null],
    ['https://youtube.com/watch?v=short', null],
  ])('%s → %s', (url, id) => {
    expect(youtubeId(url)).toBe(id)
  })
})

describe('buildCsp', () => {
  const prod = { dev: false, prod: true, mediaOrigin: 'https://cdn.example' }
  it('uses a nonce with strict-dynamic and never unsafe-inline/unsafe-eval for scripts in production', () => {
    const csp = buildCsp('abc123', 'site', prod)
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!
    expect(script).toContain("'nonce-abc123'")
    expect(script).toContain("'strict-dynamic'")
    expect(script).not.toContain('unsafe-inline')
    expect(script).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).toContain('https://cdn.example')
  })
  it('allows unsafe-eval only in development and keeps admin frames same-origin', () => {
    expect(buildCsp('n', 'site', { dev: true, prod: false, mediaOrigin: '' })).toContain(
      "'unsafe-eval'",
    )
    const admin = buildCsp('n', 'admin', prod)
    expect(admin).toContain("frame-src 'self'")
    expect(admin).not.toContain('youtube')
  })
  it('lets only our own origin frame a page, and only for a live preview of the site', () => {
    expect(buildCsp('n', 'site', prod, { previewFrame: true })).toContain("frame-ancestors 'self'")
    expect(buildCsp('n', 'site', prod, { previewFrame: false })).toContain("frame-ancestors 'none'")
    expect(buildCsp('n', 'admin', prod, { previewFrame: true })).toContain("frame-ancestors 'none'")
  })
})

describe('needsTrailingSlash', () => {
  it.each([
    ['/1234', true],
    ['/category/news', true],
    ['/1234/', false],
    ['/', false],
    ['/admin', false],
    ['/admin/collections/posts', false],
    ['/api/posts', false],
    ['/_next/static/x.js', false],
    ['/robots.txt', false],
  ])('%s → %s', (path, expected) => {
    expect(needsTrailingSlash(path)).toBe(expected)
  })
})
