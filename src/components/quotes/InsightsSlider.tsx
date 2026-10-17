'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { QuoteShare } from '@/components/quotes/QuoteShare'
import { SectionHeading } from '@/components/ui/SectionHeading'

export type InsightSlide = {
  key: string
  /** The quote's own page. */
  href: string
  /** The poster, rendered on the server; it fills the slide. */
  poster: ReactNode
  /** What the share buttons send while this slide is showing. */
  share: { url: string; text: string; posterSrc: string | null }
}

const SWIPE_PX = 40

const ARROW =
  'inline-flex size-9 items-center justify-center rounded-full bg-card text-ink shadow-card ring-1 ring-line transition hover:bg-brand hover:text-white hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95'

/**
 * The Insights card as a poster slider (up to 5): the heading with "View More", one
 * poster at a time (arrows, dots, swipe and ← / →), and under it the share options of whichever
 * poster is showing. The arrows sit either side of the dots under the poster, so nothing is drawn
 * over the artwork. Inactive slides are `inert`: only the poster in view can be reached with
 * the keyboard.
 */
export function InsightsSlider({
  slides,
  label,
  title,
  href,
}: {
  slides: InsightSlide[]
  label: string
  title: string
  href: string | null
}) {
  const count = slides.length
  const [active, setActive] = useState(0)
  const touchX = useRef<number | null>(null)
  const go = (to: number) => setActive(((to % count) + count) % count)
  const current = slides[active] ?? slides[0]
  if (!current) return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return
    if (e.key === 'ArrowRight') go(active + 1)
    if (e.key === 'ArrowLeft') go(active - 1)
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SectionHeading
        title={title}
        as="h2"
        icon={Lightbulb}
        href={href}
        moreLabel="View More"
        className="!mb-4 sm:!mb-4"
      />
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-deep ring-1 ring-line/60 lg:aspect-auto lg:min-h-[20rem] lg:flex-1"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start == null || end == null || Math.abs(end - start) < SWIPE_PX) return
          go(active + (end < start ? 1 : -1))
        }}
      >
        <div
          className="absolute inset-0 flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              inert={i !== active}
              className="relative h-full w-full shrink-0"
            >
              <Link
                href={slide.href}
                aria-label="Open this insight"
                className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                {slide.poster}
              </Link>
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(active - 1)}
            aria-label="Previous insight"
            className={ARROW}
          >
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="flex items-center justify-center gap-2" role="tablist" aria-label={label}>
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`${i + 1} / ${count}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-brand' : 'w-2 bg-line hover:bg-brand/50'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(active + 1)}
            aria-label="Next insight"
            className={ARROW}
          >
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <QuoteShare
        compact
        className="mt-4"
        url={current.share.url}
        text={current.share.text}
        posterSrc={current.share.posterSrc}
      />
    </div>
  )
}
