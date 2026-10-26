import { getPostByNumber } from '@/features/posts/queries'
import { ebookPdf, pdfDisposition, pdfSourceUrl } from '@/lib/ebook'
import { originOf } from '@/lib/security/csp'
import { cdnUrlFrom } from '@/lib/spaces'
import type { Media } from '@/payload-types'

/**
 * GET /api/ebook/<post number>[?download=1] — a published e-book's PDF, served from our own origin.
 * The reader (pdf.js) may only fetch from 'self' (site CSP connect-src), and the CDN sends no CORS
 * headers, so the file is streamed through here. Only the PDF of a published e-book post is served,
 * and only from our media route or the media CDN (never a URL taken from the request).
 */
const CDN_ORIGIN = originOf(cdnUrlFrom(process.env.DO_SPACES_CDN_ENDPOINT, process.env.NODE_ENV))

const notFound = () =>
  new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postNumber: string }> },
): Promise<Response> {
  const raw = (await params).postNumber
  if (!/^\d{1,9}$/.test(raw)) return notFound()
  const post = await getPostByNumber(Number(raw))
  if (!post || post.format !== 'ebook') return notFound()
  const pdf = ebookPdf<Media>(post)
  const source = pdfSourceUrl(pdf?.url, request.url, CDN_ORIGIN || undefined)
  if (!source) return notFound()

  const upstream = await fetch(source, { redirect: 'error', cache: 'no-store' }).catch(() => null)
  if (!upstream?.ok || !upstream.body) return notFound()

  const download = new URL(request.url).searchParams.get('download') === '1'
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': pdfDisposition(post.title, download),
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'X-Content-Type-Options': 'nosniff',
  })
  const length = upstream.headers.get('content-length')
  // fetch() decodes compressed bodies, so a compressed upstream's length would be wrong.
  if (length && !upstream.headers.get('content-encoding')) headers.set('Content-Length', length)
  return new Response(upstream.body, { status: 200, headers })
}
