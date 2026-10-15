'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const AUTOPLAY_MS = 6500
const SWIPE_PX = 48

interface HeroSliderProps {
  /** Server-rendered slides; each one fills the slider. The active one gets `data-active`. */
  slides: ReactNode[]
  label: string
  className?: string
}

/**
 * Crossfading hero carousel: dots, previous/next, swipe, autoplay. Autoplay stops on hover, focus,
 * in a background tab and for visitors who prefer reduced motion; inactive slides are `inert`.
 */
export function HeroSlider({ slides, label, className = '' }: HeroSliderProps) {
  const count = slides.length
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count])

  useEffect(() => {
    if (count < 2 || paused) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((a) => (a + 1) % count)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [count, paused, active])

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      className={`group/hero relative isolate overflow-hidden rounded-2xl bg-brand-deep shadow-card ring-1 ring-black/5 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
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
      {slides.map((slide, i) => (
        <div
          key={i}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${count}`}
          data-active={i === active ? '' : undefined}
          inert={i !== active}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === active ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          {slide}
        </div>
      ))}

      {count > 1 ? (
        <div className="absolute bottom-5 end-5 z-20 flex items-center gap-4 sm:bottom-8 sm:end-8">
          <div className="flex items-center gap-2" role="tablist" aria-label={label}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`${i + 1} / ${count}`}
                onClick={() => go(i)}
                className={`h-2.5 rounded-full transition-all duration-500 ${i === active ? 'w-7 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/75'}`}
              />
            ))}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="മുമ്പത്തേത്"
              className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/60 backdrop-blur-sm transition hover:bg-white hover:text-brand-deep active:scale-95"
            >
              <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="അടുത്തത്"
              className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/60 backdrop-blur-sm transition hover:bg-white hover:text-brand-deep active:scale-95"
            >
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      <p className="sr-only" aria-live={paused ? 'polite' : 'off'}>
        {active + 1} / {count}
      </p>
    </div>
  )
}
