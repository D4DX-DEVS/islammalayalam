'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ScrollRowProps {
  children: ReactNode
  /** dark = on the blue video band · light = on a white panel */
  tone?: 'dark' | 'light'
  /** beside = buttons in a column next to the row · overlay = buttons floating on the row's edges */
  arrows?: 'beside' | 'overlay'
  /** Extra classes for the scrolling <ul> (negative margins for edge-to-edge swipe on phones, …). */
  listClassName?: string
  /** Grow to the height the parent gives (items stretch to match); for rows inside a stretched panel. */
  fill?: boolean
  label: string
}

/**
 * Horizontal scroll-snap row (a list of `<li>` items). Swipes on touch; the previous/next buttons
 * only exist when there is more to scroll to, and dim at either end.
 */
export function ScrollRow({
  children,
  tone = 'light',
  arrows = 'overlay',
  listClassName = '',
  fill = false,
  label,
}: ScrollRowProps) {
  const list = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ scrollable: false, atStart: true, atEnd: true })

  useEffect(() => {
    const el = list.current
    if (!el) return
    const update = () =>
      setEdge({
        scrollable: el.scrollWidth > el.clientWidth + 4,
        atStart: Math.abs(el.scrollLeft) < 4,
        atEnd: Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4,
      })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      resize.disconnect()
    }
  }, [])

  const scroll = (direction: 1 | -1) => {
    const el = list.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const dark = tone === 'dark'
  const button = `inline-flex size-11 items-center justify-center rounded-lg transition active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${
    dark
      ? 'text-white ring-1 ring-white/60 hover:bg-white hover:text-brand-deep'
      : 'bg-card text-ink shadow-lift ring-1 ring-line hover:bg-brand hover:text-white hover:ring-brand'
  }`
  const prev = (
    <button
      type="button"
      onClick={() => scroll(-1)}
      disabled={edge.atStart}
      aria-label={`${label}: previous`}
      className={button}
    >
      <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
    </button>
  )
  const next = (
    <button
      type="button"
      onClick={() => scroll(1)}
      disabled={edge.atEnd}
      aria-label={`${label}: next`}
      className={button}
    >
      <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
    </button>
  )

  return (
    <div
      className={`${arrows === 'beside' ? 'flex items-center gap-4' : 'relative'} ${fill ? 'flex min-h-0 flex-1 flex-col' : ''}`}
    >
      <ul
        ref={list}
        className={`no-scrollbar flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth ${arrows === 'beside' || fill ? 'flex-1' : ''} ${listClassName}`}
      >
        {children}
      </ul>
      {edge.scrollable && arrows === 'beside' ? (
        <div className="hidden shrink-0 flex-col gap-3 sm:flex lg:flex-row">
          {prev}
          {next}
        </div>
      ) : null}
      {edge.scrollable && arrows === 'overlay' ? (
        <>
          <span className="absolute start-1 top-[38%] hidden -translate-y-1/2 sm:block">
            {prev}
          </span>
          <span className="absolute end-1 top-[38%] hidden -translate-y-1/2 sm:block">{next}</span>
        </>
      ) : null}
    </div>
  )
}
