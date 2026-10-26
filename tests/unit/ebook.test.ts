import { describe, expect, it } from 'vitest'
import { ebookFileHref, ebookPdf, pdfDisposition, pdfSourceUrl, withCategory } from '@/lib/ebook'
import { needsTrailingSlash } from '@/lib/routing'

const pdf = (url: string) => ({ url, mimeType: 'application/pdf', filename: 'book.pdf' })
const CDN = 'https://d4dx-storage.blr1.cdn.digitaloceanspaces.com'

describe('withCategory', () => {
  it('adds the category last so the primary category stays first', () => {
    expect(withCategory(['a', { id: 'b' }], 'e')).toEqual(['a', 'b', 'e'])
  })
  it('does not add it twice', () => {
    expect(withCategory([{ id: 'e' }, 'a'], 'e')).toEqual(['e', 'a'])
  })
  it('handles a post with no categories', () => {
    expect(withCategory(undefined, 'e')).toEqual(['e'])
    expect(withCategory([null, undefined], 'e')).toEqual(['e'])
  })
})

describe('ebookPdf', () => {
  it('prefers the Book PDF field', () => {
    const own = pdf(`${CDN}/own.pdf`)
    expect(ebookPdf({ ebook: { pdf: own }, attachments: [{ file: pdf(`${CDN}/a.pdf`) }] })).toBe(
      own,
    )
  })
  it('falls back to the first attached PDF (imported e-books)', () => {
    const first = pdf(`${CDN}/a.pdf`)
    expect(ebookPdf({ attachments: [{ file: 'unpopulated-id' }, { file: first }] })).toBe(first)
  })
  it('ignores non-PDF media and unpopulated ids', () => {
    expect(
      ebookPdf({
        ebook: { pdf: 'id' },
        attachments: [{ file: { url: `${CDN}/x.png`, mimeType: 'image/png' } }],
      }),
    ).toBeNull()
    expect(ebookPdf({})).toBeNull()
  })
})

describe('pdfSourceUrl', () => {
  const req = 'https://www.islammalayalam.net/api/ebook/12'
  it('accepts the media CDN', () => {
    expect(pdfSourceUrl(`${CDN}/ISLAMMALAYALAM/media/b.pdf`, req, CDN)?.href).toBe(
      `${CDN}/ISLAMMALAYALAM/media/b.pdf`,
    )
  })
  it('keeps local media on our own origin, whatever host the URL was built with', () => {
    expect(pdfSourceUrl('http://localhost:3444/api/media/file/b.pdf', req, CDN)?.href).toBe(
      'https://www.islammalayalam.net/api/media/file/b.pdf',
    )
    expect(pdfSourceUrl('/api/media/file/b.pdf', req, undefined)?.href).toBe(
      'https://www.islammalayalam.net/api/media/file/b.pdf',
    )
  })
  it('refuses any other host, plain http and junk', () => {
    expect(pdfSourceUrl('https://evil.example/b.pdf', req, CDN)).toBeNull()
    expect(pdfSourceUrl(`${CDN.replace('https', 'http')}/b.pdf`, req, CDN)).toBeNull()
    expect(pdfSourceUrl(`${CDN}/b.pdf`, req, undefined)).toBeNull()
    expect(pdfSourceUrl('', req, CDN)).toBeNull()
    expect(pdfSourceUrl(null, req, CDN)).toBeNull()
  })
})

describe('pdfDisposition', () => {
  it('sends an attachment with an ASCII fallback and the UTF-8 title', () => {
    const v = pdfDisposition('പരോപകാരം | പ്രകാശ രേഖ', true)
    expect(v.startsWith('attachment; filename="ebook.pdf"; ')).toBe(true)
    expect(pdfDisposition('Quran: Part 1', true)).toContain('filename="Quran-Part-1.pdf"')
    expect(v).toMatch(/^[\x20-\x7e]+$/)
    expect(decodeURIComponent(v.split("UTF-8''")[1]!)).toBe('പരോപകാരം പ്രകാശ രേഖ.pdf')
  })
  it('is inline for the reader and never empty', () => {
    expect(pdfDisposition('   ', false)).toBe(
      `inline; filename="ebook.pdf"; filename*=UTF-8''ebook.pdf`,
    )
  })
})

describe('ebookFileHref', () => {
  it('is a same-origin API path with no trailing-slash redirect', () => {
    expect(ebookFileHref(42)).toBe('/api/ebook/42')
    expect(ebookFileHref(42, true)).toBe('/api/ebook/42?download=1')
    expect(needsTrailingSlash('/api/ebook/42')).toBe(false)
  })
})
