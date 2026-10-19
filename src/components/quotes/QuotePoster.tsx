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
  frame = false,
  priority = false,
  sizes,
}: {
  quote: QuoteView
  siteName: string
  /** The quote's own page: bigger type. */
  large?: boolean
  /** The sidebar card: a taller poster (text quotes fill the height). */
  tall?: boolean
  /**
   * Fill the box it is placed in (the Insights slider and archive): the whole picture, never
   * cropped, with a blurred copy behind it where the shapes differ; long text is shortened.
   */
  frame?: boolean
  priority?: boolean
  sizes: string
}) {
  if (quote.poster && frame) {
    const alt = quote.text || quote.poster.alt || 'Insight'
    return (
      <span className="shine absolute inset-0 block overflow-hidden bg-brand-deep">
        <Image
          src={quote.poster.src}
          alt=""
          fill
          sizes="64px"
          className="scale-125 object-cover blur-2xl saturate-150"
          aria-hidden="true"
        />
        <Image
          src={quote.poster.src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain"
        />
      </span>
    )
  }
  if (quote.poster) {
    return (
      <span className="shine relative block overflow-hidden rounded-2xl ring-1 ring-line/60">
        <Image
          src={quote.poster.src}
          alt={quote.text || quote.poster.alt || 'Insight'}
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
  if (frame) {
    return (
      <figure className="bg-night relative isolate flex h-full flex-col justify-between gap-4 overflow-hidden px-12 pb-10 pt-6 text-white">
        <div className="min-h-0">
          <Quote className="size-9 text-accent" aria-hidden="true" />
          <blockquote
            className={`mt-3 whitespace-pre-line font-semibold leading-relaxed ${
              long ? 'line-clamp-[11] text-[0.95rem]' : 'line-clamp-[8] text-lg'
            }`}
          >
            {quote.text}
          </blockquote>
        </div>
        <div className="space-y-2">
          {quote.source ? (
            <figcaption className="truncate text-sm font-medium text-sky-200">
              — {quote.source}
            </figcaption>
          ) : null}
          <p className="border-t border-white/15 pt-3 text-xs font-semibold tracking-wide text-white/70">
            {siteName}
          </p>
        </div>
      </figure>
    )
  }
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
