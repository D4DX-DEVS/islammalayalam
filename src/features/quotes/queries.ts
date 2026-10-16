import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { mediaSrc } from '@/lib/media'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import { pickDailyQuote } from './pick'
import type { Media, Quote } from '@/payload-types'

const TAGS = [collectionTag('quotes'), collectionTag('media')]

/** A quote ready to render: text and/or poster, plus its shareable page path. */
export type QuoteView = {
  id: string
  text: string
  source: string
  /** ISO date the quote is scheduled for, if any. */
  showOn: string | null
  poster: { src: string; width: number; height: number; alt: string } | null
  href: string
}

export const quoteHref = (id: string): string => `/quote/${id}/`

function toView(doc: Quote): QuoteView | null {
  const media = doc.poster && typeof doc.poster === 'object' ? (doc.poster as Media) : null
  const src = mediaSrc(media?.sizes?.large?.url ?? media?.url)
  const poster =
    src && media?.width && media?.height
      ? {
          src,
          width: media.sizes?.large?.url ? (media.sizes.large.width ?? media.width) : media.width,
          height: media.sizes?.large?.url
            ? (media.sizes.large.height ?? media.height)
            : media.height,
          alt: media.alt ?? '',
        }
      : null
  const text = (doc.text ?? '').trim()
  if (!text && !poster) return null
  return {
    id: String(doc.id),
    text,
    source: (doc.source ?? '').trim(),
    showOn: doc.showOn ?? null,
    poster,
    href: quoteHref(String(doc.id)),
  }
}

/** Today's quote (the `day` argument, an India date, is only the cache key so it flips at midnight). */
export const getDailyQuote = cached(
  'quotes:daily:v4',
  TAGS,
  async (_day: string): Promise<QuoteView | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'quotes',
      limit: 400,
      depth: 1,
      pagination: false,
      populate: POPULATE,
      ...PUBLIC,
    })
    const picked = pickDailyQuote(
      res.docs.map((d) => ({ ...d, id: String(d.id) })),
      new Date(),
    )
    return picked ? toView(picked as Quote) : null
  },
)

const OBJECT_ID = /^[a-f0-9]{24}$/i

/** One active quote by id, or null (unknown, hidden, malformed id). */
export const getQuoteById = cached(
  'quotes:by-id:v2',
  TAGS,
  async (id: string): Promise<QuoteView | null> => {
    if (!OBJECT_ID.test(id)) return null
    const payload = await getPayloadClient()
    try {
      const doc = await payload.findByID({
        collection: 'quotes',
        id,
        depth: 1,
        populate: POPULATE,
        ...PUBLIC,
      })
      return toView(doc)
    } catch {
      return null
    }
  },
)
