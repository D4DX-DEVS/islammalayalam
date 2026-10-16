import Image from 'next/image'
import Link from 'next/link'
import { QuotePoster } from '@/components/quotes/QuotePoster'
import { QuoteShare } from '@/components/quotes/QuoteShare'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { QuoteView } from '@/features/quotes/queries'

const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3444'

/** Absolute address for sharing: link previews and share targets need the full URL. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).toString()

const CARD = 'rounded-panel bg-card p-4 shadow-card ring-1 ring-line/60 sm:p-5'

/** Shown in the poster's place until an editor adds the first quote (Admin → Quotes). */
function BrandPoster({ siteName, tagline }: { siteName: string; tagline?: string | null }) {
  return (
    <figure className="bg-night relative isolate flex min-h-[30rem] flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl p-6 text-center text-white ring-1 ring-white/10">
      <Image
        src="/brand/logo-mobile.png"
        alt={siteName}
        width={280}
        height={93}
        className="h-16 w-auto"
      />
      {tagline ? (
        <figcaption className="text-3xl font-bold leading-snug">{tagline}</figcaption>
      ) : null}
    </figure>
  )
}

/**
 * The sidebar beside the lead news section: one "Daily Quote" card with today's poster (tall) and,
 * at the bottom of the same card, the share options. With no quote yet, the poster slot shows the
 * site's own card, and sharing shares the homepage.
 */
export function DailyQuoteCard({
  quote,
  siteName,
  tagline,
}: {
  quote: QuoteView | null
  siteName: string
  tagline?: string | null
}) {
  const url = absoluteUrl(quote ? quote.href : '/')
  const text = quote
    ? [quote.text, quote.source ? `— ${quote.source}` : ''].filter(Boolean).join(' ')
    : [siteName, tagline].filter(Boolean).join(' — ')
  return (
    <section aria-label="Daily Quote" className={CARD}>
      <SectionHeading title="Daily Quote" as="h2" className="!mb-4 sm:!mb-4" />
      {quote ? (
        <Link
          href={quote.href}
          aria-label="Open this quote"
          className="group block rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <QuotePoster
            quote={quote}
            siteName={siteName}
            tall
            sizes="(min-width: 1024px) 21rem, (min-width: 640px) 28rem, 100vw"
          />
        </Link>
      ) : (
        <BrandPoster siteName={siteName} tagline={tagline} />
      )}
      <QuoteShare compact className="mt-5" url={url} text={text} posterSrc={quote?.poster?.src} />
    </section>
  )
}
