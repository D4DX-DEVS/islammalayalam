import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuoteShare } from '@/components/quotes/QuoteShare'

const URL_ = 'https://islammalayalam.net/quote/65f1c2a9e4b0a1b2c3d4e5f6/'
const WORDS = 'ജ്ഞാനം വിശ്വാസിയുടെ കളഞ്ഞുപോയ സമ്പത്താണ് — ഹദീസ്'
const enc = encodeURIComponent

const links = (props: { text: string; posterSrc?: string | null }) => {
  const html = renderToStaticMarkup(
    createElement(QuoteShare, { url: URL_, compact: true, ...props }),
  )
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'))
  return { html, hrefs, find: (part: string) => hrefs.find((h) => h.includes(part))! }
}

describe('sharing a poster', () => {
  const poster = links({ text: WORDS, posterSrc: 'https://cdn.example/poster.jpg' })

  it('sends only the website address, so the poster (the link’s preview) is the message', () => {
    expect(poster.find('wa.me')).toBe(`https://wa.me/?text=${enc(URL_)}`)
    expect(poster.find('facebook.com')).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${enc(URL_)}`,
    )
    expect(poster.find('twitter.com')).toBe(`https://twitter.com/intent/tweet?url=${enc(URL_)}`)
    expect(poster.find('t.me')).toBe(`https://t.me/share/url?url=${enc(URL_)}`)
    expect(poster.find('mailto:')).toBe(
      `mailto:?subject=${enc('Insights — Islam Malayalam')}&body=${enc(URL_)}`,
    )
  })

  it('carries none of the quote text', () => {
    expect(poster.html).not.toContain(enc(WORDS))
    for (const h of poster.hrefs) expect(decodeURIComponent(h)).not.toContain('ജ്ഞാനം')
  })
})

describe('sharing an insight with no poster', () => {
  const plain = links({ text: WORDS, posterSrc: null })

  it('shares its words, then the address', () => {
    expect(plain.find('wa.me')).toBe(`https://wa.me/?text=${enc(`${WORDS}\n${URL_}`)}`)
    expect(plain.find('facebook.com')).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${enc(URL_)}&quote=${enc(WORDS)}`,
    )
    expect(plain.find('twitter.com')).toBe(
      `https://twitter.com/intent/tweet?url=${enc(URL_)}&text=${enc(WORDS)}`,
    )
    expect(plain.find('t.me')).toBe(`https://t.me/share/url?url=${enc(URL_)}&text=${enc(WORDS)}`)
    expect(plain.find('mailto:')).toContain(`body=${enc(`${WORDS}\n${URL_}`)}`)
  })

  it('shares just the address when there are no words either', () => {
    const bare = links({ text: '', posterSrc: null })
    expect(bare.find('wa.me')).toBe(`https://wa.me/?text=${enc(URL_)}`)
    expect(bare.find('twitter.com')).toBe(`https://twitter.com/intent/tweet?url=${enc(URL_)}`)
  })
})

describe('the share row', () => {
  it('offers the networks, email and copy-link in one row, and a poster download only on the full page', () => {
    const compact = renderToStaticMarkup(
      createElement(QuoteShare, {
        url: URL_,
        text: '',
        posterSrc: 'https://cdn.example/p.jpg',
        compact: true,
      }),
    )
    const full = renderToStaticMarkup(
      createElement(QuoteShare, { url: URL_, text: '', posterSrc: 'https://cdn.example/p.jpg' }),
    )
    for (const label of ['WhatsApp', 'Facebook', 'Telegram', 'Email', 'Copy Link'])
      expect(compact).toContain(`>${label}<`)
    expect(compact).not.toContain('Download poster')
    expect(full).toContain('Download poster')
  })
})
