import { describe, expect, it } from 'vitest'
import {
  installDismissed,
  isIosSafari,
  nextScrollDir,
  serviceWorkerSource,
  swBypass,
  swCacheFirst,
} from '@/lib/pwa'

describe('installDismissed', () => {
  const now = Date.UTC(2026, 9, 26)
  it('hides the banner for two weeks after "Not now"', () => {
    expect(installDismissed(String(now - 86_400_000), now)).toBe(true)
    expect(installDismissed(String(now - 15 * 86_400_000), now)).toBe(false)
  })
  it('treats missing or junk values as not dismissed', () => {
    expect(installDismissed(null, now)).toBe(false)
    expect(installDismissed('abc', now)).toBe(false)
  })
})

describe('isIosSafari', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  it('detects iPhone Safari and iPadOS desktop-mode Safari', () => {
    expect(isIosSafari(iphone)).toBe(true)
    expect(
      isIosSafari(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        5,
      ),
    ).toBe(true)
  })
  it('skips Chrome on iOS, desktop Safari and Android', () => {
    expect(isIosSafari(iphone.replace('Version/18.0', 'CriOS/130.0'))).toBe(false)
    expect(
      isIosSafari(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        0,
      ),
    ).toBe(false)
    expect(isIosSafari('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36')).toBe(
      false,
    )
  })
})

describe('nextScrollDir', () => {
  it('hides on scroll down, shows on scroll up', () => {
    expect(nextScrollDir('up', 200, 260)).toBe('down')
    expect(nextScrollDir('down', 600, 540)).toBe('up')
  })
  it('always shows near the top and ignores jitter', () => {
    expect(nextScrollDir('down', 100, 60)).toBe('up')
    expect(nextScrollDir('down', 500, 503)).toBe('down')
    expect(nextScrollDir('up', 500, 497)).toBe('up')
  })
})

describe('service worker rules', () => {
  it('never touches admin, API, previews or itself', () => {
    for (const p of [
      '/admin',
      '/admin/collections/posts',
      '/api/media/file/x.webp',
      '/next/preview',
      '/sw.js',
      '/_next/image',
    ])
      expect(swBypass(p)).toBe(true)
    expect(swBypass('/4306/')).toBe(false)
  })
  it('serves hashed and brand assets cache-first only', () => {
    expect(swCacheFirst('/_next/static/chunks/app.js')).toBe(true)
    expect(swCacheFirst('/brand/icon-192.png')).toBe(true)
    expect(swCacheFirst('/category/news/')).toBe(false)
  })
  it('embeds the version and the same rules, and parses as JS', () => {
    const src = serviceWorkerSource('abc123')
    expect(src).toContain('"abc123"')
    expect(src).toContain('"/admin"')
    expect(src).toContain('"/_next/static/"')
    expect(src).toContain('skipWaiting')
    expect(() => new Function(src)).not.toThrow()
  })
})
