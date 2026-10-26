'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, ExternalLink, Play, Share2, X } from 'lucide-react'
import type { Short } from '@/lib/youtube-shorts'

const ROUND =
  'inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 disabled:hover:bg-white/12'

const watchUrl = (id: string) => `https://www.youtube.com/shorts/${id}`

/** Share sheet where the device has one, else the YouTube link is copied. */
function ShareShort({ short }: { short: Short }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = watchUrl(short.id)
    try {
      if (navigator.share) await navigator.share({ title: short.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Link copied' : 'Share this Short'}
      className={ROUND}
    >
      {copied ? (
        <Check className="size-5" aria-hidden="true" />
      ) : (
        <Share2 className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * The Shorts player, as on YouTube: a full-screen, upright feed that moves one Short at a time when
 * scrolled or swiped up/down (CSS scroll snap). Only the Short on screen loads its player (privacy
 * mode); the others are posters, so moving on stops the one that was playing. ↑ / ↓ (and ← / →) and
 * the arrow buttons step through. A native modal <dialog>: focus stays inside, Esc closes and focus
 * returns to the poster that opened it.
 */
export function ShortsLightbox({
  shorts,
  index,
  onIndexChange,
  onClose,
}: {
  shorts: Short[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const feed = useRef<HTMLDivElement>(null)
  const latest = useRef({ index, onIndexChange })
  useEffect(() => {
    latest.current = { index, onIndexChange }
  })
  const count = shorts.length

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    // Guarded: in development React runs this twice, and a modal cannot be opened twice.
    if (!d.open) d.showModal()
    d.querySelector<HTMLElement>('[data-close]')?.focus()
    // Start on the Short that was clicked.
    feed.current?.children[latest.current.index]?.scrollIntoView({ block: 'start' })
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    // No d.close() here: taking the dialog out of the page ends the modal, and closing it would
    // report "closed" to the parent and shut a popup that was only being re-created.
    return () => {
      root.style.overflow = before
    }
  }, [])

  // The Short that fills most of the screen is the one playing.
  useEffect(() => {
    const el = feed.current
    if (!el) return
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const i = Number((e.target as HTMLElement).dataset.index)
          if (i !== latest.current.index) latest.current.onIndexChange(i)
        }
      },
      { root: el, threshold: 0.6 },
    )
    for (const child of Array.from(el.children)) seen.observe(child)
    return () => seen.disconnect()
  }, [count])

  const go = (step: 1 | -1) => {
    const next = index + step
    if (next < 0 || next >= count) return
    feed.current?.children[next]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const short = shorts[index]
  if (!short) return null

  return (
    <dialog
      ref={dialog}
      aria-label={short.title}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(1)
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(-1)
        else return
        e.preventDefault()
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-[#0b0f17] p-0 text-white backdrop:bg-black/85"
    >
      <div
        ref={feed}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shorts.map((s, i) => (
          <section
            key={s.id}
            data-index={i}
            aria-label={`${i + 1} / ${count}: ${s.title}`}
            className="flex h-full snap-start snap-always items-center justify-center px-2 py-3 sm:py-5"
          >
            <div className="flex h-full max-w-full items-end gap-3">
              <div className="relative aspect-[9/16] h-full max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]">
                {i === index ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&playsinline=1&rel=0`}
                    title={s.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    className="absolute inset-0 size-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() =>
                      feed.current?.children[i]?.scrollIntoView({
                        block: 'start',
                        behavior: 'smooth',
                      })
                    }
                    aria-label={`Play: ${s.title}`}
                    className="absolute inset-0 size-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's poster, shown only while scrolling past */}
                    <img
                      src={s.thumb}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover opacity-70"
                    />
                    <span className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 ring-2 ring-white/70">
                      <Play className="ms-1 size-7 fill-current" aria-hidden="true" />
                    </span>
                  </button>
                )}
                {/* Title over the bottom of a poster; the playing Short shows YouTube's own. */}
                {i !== index ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-16">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{s.title}</p>
                    {s.subtitle ? (
                      <p className="mt-0.5 truncate text-xs text-white/70">{s.subtitle}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/* Action rail beside the video (as on YouTube); on a phone it sits over the right edge. */}
              <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-3 sm:static sm:pb-2">
                <ShareShort short={s} />
                <a
                  href={watchUrl(s.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch on YouTube"
                  className={ROUND}
                >
                  <ExternalLink className="size-5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <span className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold tabular-nums backdrop-blur-sm">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          data-close
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          className={`${ROUND} pointer-events-auto`}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous Short"
          className={ROUND}
        >
          <ChevronUp className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === count - 1}
          aria-label="Next Short"
          className={ROUND}
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
      </div>
    </dialog>
  )
}
