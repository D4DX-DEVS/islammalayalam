/**
 * E-book helpers shared by the Posts hooks, the PDF route and the post page. Pure: no Payload, no
 * network, so they are unit-tested directly (tests/unit/ebook.test.ts).
 */

/** Slug of the category every e-book is listed under (/category/e-books/). */
export const EBOOK_CATEGORY_SLUG = 'e-books'

type Ref = string | { id: string } | null | undefined
const refId = (ref: Ref): string | null => (typeof ref === 'string' ? ref : (ref?.id ?? null))

/** The post's categories with `categoryId` added at the end when missing (the first one stays primary). */
export function withCategory(categories: Ref[] | null | undefined, categoryId: string): string[] {
  const ids = (categories ?? []).map(refId).filter((id): id is string => Boolean(id))
  return ids.includes(categoryId) ? ids : [...ids, categoryId]
}

type PdfMedia = { url?: string | null; mimeType?: string | null; filename?: string | null }
type EbookPost = {
  ebook?: { pdf?: unknown } | null
  attachments?: Array<{ file?: unknown }> | null
}
const asPdf = (v: unknown): PdfMedia | null =>
  v &&
  typeof v === 'object' &&
  (v as PdfMedia).mimeType === 'application/pdf' &&
  (v as PdfMedia).url
    ? (v as PdfMedia)
    : null

/** The book's PDF: the "Book PDF" field, else the first attached PDF (e-books imported from WordPress). */
export function ebookPdf<T extends PdfMedia = PdfMedia>(post: EbookPost): T | null {
  const own = asPdf(post.ebook?.pdf)
  if (own) return own as T
  for (const a of post.attachments ?? []) {
    const pdf = asPdf(a.file)
    if (pdf) return pdf as T
  }
  return null
}

/** Same-origin address of the book's PDF (the reader may only fetch from our own origin). */
export const ebookFileHref = (postNumber: number, download = false): string =>
  `/api/ebook/${postNumber}${download ? '?download=1' : ''}`

/**
 * Where the PDF route may fetch a book from: our own media route, or the media CDN. Anything else
 * (a hand-edited URL in the database) is refused, so the route can never fetch arbitrary hosts.
 */
export function pdfSourceUrl(
  url: string | null | undefined,
  requestUrl: string,
  cdnOrigin: string | undefined,
): URL | null {
  if (!url) return null
  try {
    const u = new URL(url, requestUrl)
    if (u.pathname.startsWith('/api/media/file/')) return new URL(u.pathname + u.search, requestUrl)
    if (cdnOrigin && u.protocol === 'https:' && u.origin === cdnOrigin) return u
    return null
  } catch {
    return null
  }
}

/** `Content-Disposition` with a plain-ASCII fallback name and the real (Malayalam) title as UTF-8. */
export function pdfDisposition(title: string, download: boolean): string {
  const base = (title.trim() || 'ebook').slice(0, 120)
  const ascii =
    base
      .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-') || 'ebook'
  const name = `${base.replace(/[\\/:*?"<>|\s]+/g, ' ').trim()}.pdf`
  return `${download ? 'attachment' : 'inline'}; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`
}
