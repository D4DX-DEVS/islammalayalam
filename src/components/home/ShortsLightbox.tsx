'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import type { Short } from '@/lib/youtube-shorts'

/**
 * The popup that plays a Short, upright. A native modal <dialog>: the browser traps focus, closes it
 * on Esc and returns focus to the poster. The player (privacy mode) only loads while a Short is
 * open, and changing Short or closing the popup stops the one that was playing. ← / → (and the
 * buttons) go to the previous / next Short.
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
  const short = shorts[index]
  const count = shorts.length

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    // Guarded: in development React runs this twice, and a modal cannot be opened twice.
    if (!d.open) d.showModal()
    d.querySelector<HTMLElement>('[data-close]')?.focus()
    // A modal dialog does not stop the page behind it from scrolling.
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    // No d.close() here: taking the dialog out of the page ends the modal, and closing it would
    // report "closed" to the parent and shut a popup that was only being re-created.
    return () => {
      root.style.overflow = before
    }
  }, [])

  if (!short) return null
  const go = (step: 1 | -1) => onIndexChange((index + step + count) % count)
  const button =
    'inline-flex size-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35'

  return (
    // Esc and the close button are the keyboard ways out; clicking the dim area is a pointer extra.
    <dialog
      ref={dialog}
      aria-label={short.title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      style={{ width: 'min(92vw, calc((100dvh - 11rem) * 9 / 16))' }}
      className="m-auto max-w-none overflow-hidden rounded-2xl bg-[#0b0f17] p-0 text-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{short.title}</p>
          {short.subtitle ? (
            <p className="mt-0.5 truncate text-xs text-white/65">{short.subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          data-close
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          className={`${button} shrink-0`}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="relative aspect-[9/16] w-full bg-black">
        <iframe
          key={short.id}
          src={`https://www.youtube-nocookie.com/embed/${short.id}?autoplay=1&playsinline=1&rel=0`}
          title={short.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="absolute inset-0 size-full border-0"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <button type="button" onClick={() => go(-1)} aria-label="Previous Short" className={button}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <a
          href={`https://www.youtube.com/shorts/${short.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white"
        >
          <span className="tabular-nums">
            {index + 1} / {count}
          </span>
          <span aria-hidden="true">·</span>
          Watch on YouTube
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
        <button type="button" onClick={() => go(1)} aria-label="Next Short" className={button}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </dialog>
  )
}
