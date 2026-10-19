'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink, VideoOff, X } from 'lucide-react'

/**
 * A video tile that plays its YouTube video in a popup (lightbox) instead of leaving the page. The
 * popup is a native modal <dialog>: the browser traps focus inside it, closes it on Esc and puts
 * focus back on the tile. It only loads the player (privacy mode, youtube-nocookie) once opened,
 * and removing it stops the video. A post without a YouTube video falls back to a plain link.
 */
export function VideoLightbox({
  videoId,
  title,
  author,
  href,
  status = 'unknown',
  className,
  children,
}: {
  videoId: string | null | undefined
  title: string
  /** Who it is by, if known (shown under the title in the popup). */
  author?: string | null
  /** The video's post page: the fallback link, and "Open the post" inside the popup. Null for a quick entry that has no page. */
  href: string | null
  /** What YouTube says about the video (lib/youtube.ts): a removed one gets our own notice, not YouTube's error. */
  status?: 'ok' | 'external' | 'gone' | 'unknown'
  className?: string
  /** The tile's picture and title (rendered on the server). */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!open || !d) return
    d.showModal()
    // Start on the close button, so Esc, Enter or Space closes the popup straight away.
    d.querySelector<HTMLElement>('[data-close]')?.focus()
    // A modal dialog does not stop the page behind it from scrolling.
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = before
      if (d.open) d.close()
    }
  }, [open])

  if (!videoId) {
    return href ? (
      <Link href={href} className={className}>
        {children}
      </Link>
    ) : (
      <div className={className}>{children}</div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Play video: ${title}`}
        className={`${className ?? ''} w-full cursor-pointer text-start`}
      >
        {children}
      </button>
      {open ? (
        // Esc and the close button are the keyboard ways out; clicking the dim area is a pointer extra.
        <dialog
          ref={dialog}
          aria-label={title}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close()
          }}
          className="m-auto w-[min(96vw,66rem)] max-w-none overflow-hidden rounded-2xl bg-[#0b0f17] p-0 text-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                {title}
              </p>
              {author ? <p className="mt-0.5 truncate text-xs text-white/65">{author}</p> : null}
            </div>
            {href ? (
              <Link
                href={href}
                className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                Open the post
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <button
              type="button"
              data-close
              onClick={() => dialog.current?.close()}
              aria-label="Close video"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {status === 'gone' || status === 'external' ? (
            <div
              className="flex aspect-video flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0f3d7a] to-[#06142b] px-6 text-center"
              data-video-status={status}
            >
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
                <VideoOff className="size-6" aria-hidden="true" />
              </span>
              <p className="max-w-md text-base font-semibold leading-relaxed sm:text-lg">
                {status === 'external'
                  ? 'This video can only be watched on YouTube'
                  : 'This video is no longer available on YouTube'}
              </p>
              {status === 'external' ? (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#0b0f17] transition-colors hover:bg-brand-soft"
                >
                  Watch on YouTube
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : (
            <div className="relative aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
                title={title}
                allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                className="absolute inset-0 size-full"
              />
            </div>
          )}
        </dialog>
      ) : null}
    </>
  )
}
