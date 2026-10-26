import { describe, expect, it } from 'vitest'
import { DEVELOPMENT_URL, PRODUCTION_URL, siteUrlFrom } from '@/lib/site-url'
import { sitemapEntries } from '@/lib/sitemap'

describe('siteUrlFrom', () => {
  it('is the configured address', () => {
    expect(siteUrlFrom('https://staging.example.org', 'production')).toBe(
      'https://staging.example.org',
    )
    expect(siteUrlFrom(' http://localhost:4000 ', 'development')).toBe('http://localhost:4000')
  })
  it('is the real domain when a production build was made without it, never localhost', () => {
    expect(siteUrlFrom(undefined, 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('', 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('   ', 'production')).toBe(PRODUCTION_URL)
  })
  it('is the real domain when a production build was given a local address', () => {
    expect(siteUrlFrom('http://localhost:3444', 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('http://127.0.0.1:3000', 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('http://0.0.0.0:8080', 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('http://[::1]:3444', 'production')).toBe(PRODUCTION_URL)
    expect(siteUrlFrom('not a url', 'production')).toBe(PRODUCTION_URL)
  })
  it('drops a trailing slash so paths join cleanly', () => {
    expect(siteUrlFrom('https://islammalayalam.net/', 'production')).toBe(PRODUCTION_URL)
    expect(PRODUCTION_URL).toBe('https://islammalayalam.net')
  })
  it('is the local address in development and tests', () => {
    expect(siteUrlFrom(undefined, 'development')).toBe(DEVELOPMENT_URL)
    expect(siteUrlFrom(undefined, 'test')).toBe(DEVELOPMENT_URL)
    expect(siteUrlFrom(undefined, undefined)).toBe(DEVELOPMENT_URL)
  })
})

describe('sitemapEntries', () => {
  const base = 'https://islammalayalam.net'
  const sources = {
    categories: [{ slug: 'ചോദ്യോത്തരം', updatedAt: '2026-09-30T07:40:59.095Z' }, { slug: null }],
    pages: [{ path: 'about', updatedAt: '2026-10-01T00:00:00.000Z' }, { path: 'ആദർശം/വിശ്വാസം' }],
    posts: [
      { postNumber: 4287, updatedAt: '2026-10-17T10:05:00.000Z' },
      { postNumber: 4287 },
      { postNumber: null },
      { postNumber: 226, updatedAt: 'not a date' },
    ],
  }
  const entries = sitemapEntries(base, sources)
  const urls = entries.map((e) => e.url)

  it('lists home and the Insights archive first, then categories, pages and posts', () => {
    expect(urls.slice(0, 2)).toEqual([`${base}/`, `${base}/insights/`])
    expect(urls.indexOf(`${base}/about/`)).toBeGreaterThan(
      urls.findIndex((u) => u.includes('/category/')),
    )
    expect(urls.indexOf(`${base}/4287/`)).toBeGreaterThan(urls.indexOf(`${base}/about/`))
  })

  it('writes Malayalam paths percent-encoded, as full addresses on the site', () => {
    expect(urls).toContain(`${base}/category/${encodeURIComponent('ചോദ്യോത്തരം')}/`)
    expect(urls).toContain(
      `${base}/${encodeURIComponent('ആദർശം')}/${encodeURIComponent('വിശ്വാസം')}/`,
    )
    for (const url of urls) expect(url).toMatch(/^https:\/\/islammalayalam\.net\/[\x21-\x7e]*$/)
  })

  it('lists each address once, and skips entries with nothing to point at', () => {
    expect(urls.filter((u) => u === `${base}/4287/`)).toHaveLength(1)
    expect(urls.some((u) => u.endsWith('/null/') || u.endsWith('/category/null/'))).toBe(false)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('carries the last-modified date when there is a valid one', () => {
    expect(entries.find((e) => e.url === `${base}/4287/`)?.lastModified).toEqual(
      new Date('2026-10-17T10:05:00.000Z'),
    )
    expect(entries.find((e) => e.url === `${base}/226/`)?.lastModified).toBeUndefined()
    expect(entries.find((e) => e.url === `${base}/`)?.lastModified).toBeUndefined()
  })

  it('is just home and Insights when the site has no content yet', () => {
    expect(
      sitemapEntries(base, { posts: [], pages: [], categories: [] }).map((e) => e.url),
    ).toEqual([`${base}/`, `${base}/insights/`])
  })
})
