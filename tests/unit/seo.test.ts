import { describe, expect, it } from 'vitest'
import {
  articleJsonLd,
  breadcrumbJsonLd,
  describe as describeText,
  DESCRIPTION_LENGTH,
  jsonLdHtml,
  postDescription,
  siteJsonLd,
} from '@/lib/seo'
import { llmsTxt } from '@/lib/llms'
import { DEFAULT_SHARE_IMAGE, shareImage } from '@/lib/media'

const base = 'https://islammalayalam.net'

describe('describe', () => {
  it('flattens whitespace and keeps short text whole', () => {
    expect(describeText('  ഇസ്‌ലാമിനെ\n\n അറിയാൻ ')).toBe('ഇസ്‌ലാമിനെ അറിയാൻ')
  })
  it('is nothing for empty text', () => {
    expect(describeText('')).toBeUndefined()
    expect(describeText('   ')).toBeUndefined()
    expect(describeText(null)).toBeUndefined()
  })
  it('cuts long text at a word, within the limit, with an ellipsis', () => {
    const long = Array.from({ length: 60 }, (_, i) => `വാക്ക്${i}`).join(' ')
    const out = describeText(long)!
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH)
    expect(out.endsWith('…')).toBe(true)
    expect(long.startsWith(out.slice(0, -1))).toBe(true)
    expect(out.slice(0, -1)).not.toMatch(/\s$/)
  })
})

describe('postDescription', () => {
  const content = {
    root: {
      children: [
        { type: 'heading', children: [{ text: 'ആമുഖം' }] },
        { type: 'paragraph', children: [{ text: 'ഒന്നാം ' }, { text: 'വാക്യം.' }] },
      ],
    },
  }
  it('prefers the SEO description, then the excerpt', () => {
    expect(postDescription({ meta: { description: 'SEO' }, excerpt: 'Ex', content })).toBe('SEO')
    expect(postDescription({ meta: { description: '' }, excerpt: 'Ex', content })).toBe('Ex')
  })
  it('falls back to the body text, blocks separated by a space', () => {
    expect(postDescription({ content })).toBe('ആമുഖം ഒന്നാം വാക്യം.')
  })
  it('is nothing when there is no text at all', () => {
    expect(postDescription({})).toBeUndefined()
    expect(postDescription({ content: { root: { children: [] } } })).toBeUndefined()
  })
})

describe('jsonLdHtml', () => {
  it('cannot close the script tag', () => {
    const html = jsonLdHtml({ name: '</script><script>alert(1)</script>' })
    expect(html).not.toContain('<')
    expect(JSON.parse(html).name).toBe('</script><script>alert(1)</script>')
  })
})

describe('siteJsonLd', () => {
  const ld = siteJsonLd(
    {
      name: 'Islam Malayalam',
      alternateName: 'ഇസ്‌ലാം മലയാളം',
      description: 'ഇസ്‌ലാമിനെ അറിയാൻ',
      logo: `${base}/brand/icon-512.png`,
      profiles: [
        'https://www.youtube.com/@x',
        null,
        'javascript:alert(1)',
        'http://insecure.example',
      ],
    },
    base,
  )
  const [org, site] = ld['@graph'] as Record<string, unknown>[]
  it('describes the publisher with only https profiles', () => {
    expect(org['@type']).toBe('Organization')
    expect(org.url).toBe(`${base}/`)
    expect(org.sameAs).toEqual(['https://www.youtube.com/@x'])
  })
  it('describes the site with its search', () => {
    expect(site['@type']).toBe('WebSite')
    expect(site.inLanguage).toBe('ml')
    expect(site.publisher).toEqual({ '@id': `${base}/#organization` })
    expect(JSON.stringify(site.potentialAction)).toContain(`${base}/search/?q={search_term_string}`)
  })
})

describe('articleJsonLd', () => {
  it('describes the article with full addresses', () => {
    const ld = articleJsonLd(
      {
        path: '/5459/',
        title: 'സമാനതകളില്ലാത്ത മനുഷ്യൻ',
        description: 'd',
        images: [`${base}/a.webp`],
        publishedAt: '2022-11-08T04:57:23.000Z',
        author: { name: 'Author', path: '/author/a/' },
        section: 'News',
      },
      base,
    )
    expect(ld).toMatchObject({
      '@type': 'Article',
      url: `${base}/5459/`,
      mainEntityOfPage: `${base}/5459/`,
      headline: 'സമാനതകളില്ലാത്ത മനുഷ്യൻ',
      datePublished: '2022-11-08T04:57:23.000Z',
      dateModified: '2022-11-08T04:57:23.000Z',
      author: { '@type': 'Person', name: 'Author', url: `${base}/author/a/` },
      publisher: { '@id': `${base}/#organization` },
      articleSection: 'News',
      inLanguage: 'ml',
    })
  })
  it('credits the publisher when there is no author, and keeps the headline short', () => {
    const ld = articleJsonLd({ path: '/1/', title: 'x'.repeat(200) }, base)
    expect(ld.author).toEqual({ '@id': `${base}/#organization` })
    expect((ld.headline as string).length).toBeLessThanOrEqual(110)
    expect(ld).not.toHaveProperty('image')
    expect(ld).not.toHaveProperty('datePublished')
  })
})

describe('breadcrumbJsonLd', () => {
  it('starts at home, percent-encodes paths, and leaves the current page unlinked', () => {
    const ld = breadcrumbJsonLd(
      [{ name: 'ചോദ്യോത്തരം', path: '/category/ചോദ്യോത്തരം/' }, { name: 'Post' }],
      base,
    )
    const items = ld.itemListElement as Record<string, unknown>[]
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(items[0]).toMatchObject({ name: 'Home', item: `${base}/` })
    expect(items[1].item).toBe(`${base}/category/${encodeURIComponent('ചോദ്യോത്തരം')}/`)
    expect(items[2]).not.toHaveProperty('item')
  })
})

describe('shareImage', () => {
  it('uses the large size, then the original, then the site default', () => {
    expect(
      shareImage({
        url: 'https://cdn.example/o.webp',
        sizes: { large: { url: 'https://cdn.example/l.webp' } },
      }),
    ).toBe('https://cdn.example/l.webp')
    expect(shareImage({ url: 'https://cdn.example/o.webp', sizes: { large: { url: null } } })).toBe(
      'https://cdn.example/o.webp',
    )
    expect(shareImage(null)).toBe(DEFAULT_SHARE_IMAGE)
    expect(shareImage('unpopulated-id')).toBe(DEFAULT_SHARE_IMAGE)
    expect(shareImage({ url: 'http://insecure.example/x.jpg' })).toBe(DEFAULT_SHARE_IMAGE)
  })
})

describe('llmsTxt', () => {
  const txt = llmsTxt(
    {
      name: 'Islam Malayalam',
      alternateName: 'ഇസ്‌ലാം മലയാളം',
      tagline: 'ഇസ്‌ലാമിനെ അറിയാൻ',
      categories: [
        { name: 'ചോദ്യോത്തരം', slug: 'ചോദ്യോത്തരം' },
        { name: 'No slug', slug: null },
      ],
      posts: [
        { title: 'A [tricky]\ntitle', postNumber: 5459 },
        { title: 'No number', postNumber: null },
      ],
    },
    base,
  )
  it('opens with the site name and tagline (llmstxt.org layout)', () => {
    expect(txt.startsWith('# Islam Malayalam (ഇസ്‌ലാം മലയാളം)\n\n> ഇസ്‌ലാമിനെ അറിയാൻ\n')).toBe(true)
  })
  it('lists sections and articles as full links, skipping ones with no address', () => {
    expect(txt).toContain(`- [ചോദ്യോത്തരം](${base}/category/${encodeURIComponent('ചോദ്യോത്തരം')}/)`)
    expect(txt).toContain(`- [A tricky title](${base}/5459/)`)
    expect(txt).not.toContain('No slug')
    expect(txt).not.toContain('No number')
    expect(txt).toContain(`(${base}/sitemap.xml)`)
  })
})
