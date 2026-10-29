import Image from 'next/image'
import { Lightbulb } from 'lucide-react'
import { InsightsSlider, type InsightSlide } from '@/components/quotes/InsightsSlider'
import { QuotePoster } from '@/components/quotes/QuotePoster'
import { QuoteShare } from '@/components/quotes/QuoteShare'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { QuoteView } from '@/features/quotes/queries'
import { absoluteUrl } from '@/lib/absolute-url'

const CARD = 'flex h-full flex-col rounded-panel bg-card p-4 shadow-card ring-1 ring-line/60 sm:p-5'

/** Shown in the poster's place until an editor adds the first insight (Admin → Insights). */
function BrandPoster({ siteName, tagline }: { siteName: string; tagline?: string | null }) {
  return (
    <figure className="bg-night relative isolate flex aspect-[4/5] flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl p-6 text-center text-white ring-1 ring-white/10 lg:aspect-auto lg:min-h-[20rem] lg:flex-1">
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

const shareText = (quote: QuoteView) =>
  [quote.text, quote.source ? `— ${quote.source}` : ''].filter(Boolean).join(' ')

/**
 * The "Insights" card beside the lead news section (as tall as the news panel): the latest posters (up to 5) as a slider (one at a time,
 * arrows to move), "View More" on top for the archive, and the share options underneath. With no
 * insight yet, the poster slot shows the site's own card and sharing shares the homepage.
 */
export function InsightsCard({
  quotes,
  siteName,
  tagline,
}: {
  quotes: QuoteView[]
  siteName: string
  tagline?: string | null
}) {
  const slides: InsightSlide[] = quotes.map((quote, i) => ({
    key: quote.id,
    href: quote.href,
    poster: (
      <QuotePoster
        quote={quote}
        siteName={siteName}
        frame
        priority={i === 0}
        sizes="(min-width: 1024px) 21rem, (min-width: 640px) 28rem, 100vw"
      />
    ),
    share: {
      // An Instagram insight opens the post on Instagram, but is shared as the site's own
      // Insights page, so the shared picture and caption carry this site's address.
      url: absoluteUrl(/^https?:/i.test(quote.href) ? '/insights/' : quote.href),
      text: shareText(quote),
      posterSrc: quote.poster?.src ?? null,
    },
  }))
  return (
    <section aria-label="Insights" className={CARD}>
      {slides.length ? (
        <InsightsSlider slides={slides} label="Insights" title="Insights" href="/insights/" />
      ) : (
        <>
          <SectionHeading title="Insights" as="h2" icon={Lightbulb} className="!mb-4 sm:!mb-4" />
          <BrandPoster siteName={siteName} tagline={tagline} />
          <QuoteShare
            compact
            className="mt-5"
            url={absoluteUrl('/')}
            text={[siteName, tagline].filter(Boolean).join(' — ')}
          />
        </>
      )}
    </section>
  )
}
