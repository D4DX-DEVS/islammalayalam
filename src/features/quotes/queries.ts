import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { mediaSrc } from '@/lib/media'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import { istDayKey } from '@/lib/quote'
import type { InstagramPost } from '@/lib/instagram'
import { getInstagramPosts } from '@/features/instagram/queries'
import { showableQuotes } from './pick'
import type { Media, Quote } from '@/payload-types'

const TAGS = [collectionTag('quotes'), collectionTag('media')]

/** A quote ready to render: text and/or poster, plus its shareable page path. */
export type QuoteView = {
  id: string
  text: string
  source: string
  /** ISO date the quote is scheduled for, if any. */
  showOn: string | null
  /** The date it counts from: "Show on", else when it was created. */
  date: string | null
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
    date: doc.showOn ?? doc.createdAt ?? null,
    poster,
    href: quoteHref(String(doc.id)),
  }
}

/**
 * Every quote that may be shown today, in the admin's order (top row first). The `day` argument (an India date) is only the
 * cache key, so the list refreshes at midnight and a quote dated for tomorrow appears on time.
 */
const loadShowable = cached(
  'quotes:showable:v3',
  TAGS,
  async (_day: string): Promise<QuoteView[]> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'quotes',
      limit: 400,
      depth: 1,
      pagination: false,
      populate: POPULATE,
      ...PUBLIC,
    })
    return showableQuotes(
      res.docs.map((d) => ({ ...d, id: String(d.id) })),
      new Date(),
    ).flatMap((doc) => {
      const view = toView(doc as Quote)
      return view ? [view] : []
    })
  },
)

/**
 * An Instagram picture post as an insight: the picture is the poster and the caption its text.
 * It opens (and is shared as) the post on Instagram; posts are mostly 4:5 portraits.
 */
const fromInstagram = (post: InstagramPost): QuoteView => ({
  id: `ig-${post.id}`,
  text: post.caption,
  source: '',
  showOn: null,
  date: post.timestamp,
  poster: { src: post.image, width: 1080, height: 1350, alt: post.caption },
  href: post.permalink,
})

/**
 * What Insights show: the newest picture posts of the site's Instagram account when it is connected
 * (INSTAGRAM_ACCESS_TOKEN), else the insights added in the admin, in the admin's order.
 */
async function showable(): Promise<QuoteView[]> {
  const posts = await getInstagramPosts()
  if (posts.length) return posts.map(fromInstagram)
  return loadShowable(istDayKey(new Date()) ?? '')
}

/** The first `count` quotes in the admin's order: the homepage Insights slider. */
export async function getLatestQuotes(count: number): Promise<QuoteView[]> {
  return (await showable()).slice(0, Math.max(0, count))
}

export type QuotePage = { docs: QuoteView[]; page: number; totalPages: number; totalDocs: number }

/** One page of the Insights archive, in the admin's order. */
export async function getQuotesPage(page: number, perPage: number): Promise<QuotePage> {
  const all = await showable()
  const totalPages = Math.max(1, Math.ceil(all.length / perPage))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  return {
    docs: all.slice((current - 1) * perPage, current * perPage),
    page: current,
    totalPages,
    totalDocs: all.length,
  }
}

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
