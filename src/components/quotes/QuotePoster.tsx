import Image from 'next/image'
import { Quote } from 'lucide-react'
import type { QuoteView } from '@/features/quotes/queries'

/**
 * The quote as a picture: the uploaded poster, or — for a text-only quote — the text on a designed
 * royal-blue card, so every quote has something worth sharing.
 */
export function QuotePoster({
  quote,
  siteName,
  large = false,
  tall = false,
  priority = false,
  sizes,
}: {
  quote: QuoteView
  siteName: string
  /** The quote's own page: bigger type. */
  large?: boolean
  /** The sidebar card: a taller poster (text quotes fill the height). */
  tall?: boolean
  priority?: boolean
  sizes: string
}) {
  if (quote.poster) {
    return (
      <span className="shine relative block overflow-hidden rounded-2xl ring-1 ring-line/60">
        <Image
          src={quote.poster.src}
          alt={quote.text || quote.poster.alt || 'Daily Quote'}
          width={quote.poster.width}
          height={quote.poster.height}
          sizes={sizes}
          priority={priority}
          className="h-auto w-full"
        />
      </span>
    )
  }
  const long = quote.text.length > 220
  return (
    <figure
      className={`bg-night relative isolate flex flex-col justify-between gap-6 overflow-hidden rounded-2xl text-white ring-1 ring-white/10 ${large ? 'min-h-[22rem] p-8 sm:p-12' : tall ? 'min-h-[30rem] p-7' : 'min-h-[18rem] p-6'}`}
    >
      <div>
        <Quote className={`${large ? 'size-12' : 'size-9'} text-accent`} aria-hidden="true" />
        <blockquote
          className={`mt-4 whitespace-pre-line font-semibold leading-relaxed ${
            large
              ? long
                ? 'text-xl sm:text-2xl'
                : 'text-2xl sm:text-3xl'
              : long
                ? 'text-base'
                : 'text-lg'
          }`}
        >
          {quote.text}
        </blockquote>
      </div>
      <div className="space-y-2">
        {quote.source ? (
          <figcaption className="text-sm font-medium text-sky-200">— {quote.source}</figcaption>
        ) : null}
        <p className="border-t border-white/15 pt-3 text-xs font-semibold tracking-wide text-white/70">
          {siteName}
        </p>
      </div>
    </figure>
  )
}
