'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Share2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { openBook, type Book, type BookStatus } from '@/components/ebook/flipbook'

type EbookReaderProps = {
  title: string
  /** Same-origin PDF address (/api/ebook/<n>) the reader loads. */
  src: string
  /** The same PDF as a download. */
  downloadHref: string
  /** The book's page address, shared from inside the reader. */
  shareUrl: string
  /** Extra classes for the "Read the book" button. */
  className?: string
  /** Button content; defaults to an icon and "Read the book". */
  children?: ReactNode
}

const iconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

/**
 * "Read the book": opens the PDF as a page-turning book in a full-screen popup (native modal
 * <dialog>: focus stays inside, Esc closes). Pages turn by dragging a corner, tapping the page edges,
 * the arrow buttons or the keyboard arrows. Nothing is downloaded until the popup opens.
 */
export function EbookReader({
  title,
  src,
  downloadHref,
  shareUrl,
  className,
  children,
}: EbookReaderProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<BookStatus>({ kind: 'loading', progress: null })
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const book = useRef<Book | null>(null)

  useEffect(() => {
    const d = dialog.current
    const host = stage.current
    if (!open || !d || !host) return
    d.showModal()
    d.querySelector<HTMLElement>('[data-close]')?.focus()
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'

    let cancelled = false
    setStatus({ kind: 'loading', progress: null })
    openBook(host, src, (s) => !cancelled && setStatus(s))
      .then((b) => (cancelled ? b.destroy() : (book.current = b)))
      .catch(() => !cancelled && setStatus({ kind: 'error' }))
    return () => {
      cancelled = true
      book.current?.destroy()
      book.current = null
      host.replaceChildren()
      root.style.overflow = before
      if (d.open) d.close()
    }
  }, [open, src])

  const [copied, setCopied] = useState(false)
  // The phone's share sheet where there is one, else the link is copied.
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: shareUrl })
      else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  }

  const ready = status.kind === 'ready' ? status : null
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') book.current?.next()
    else if (e.key === 'ArrowLeft') book.current?.prev()
    else if (e.key === 'Home') book.current?.first()
    else if (e.key === 'End') book.current?.last()
    else return
    e.preventDefault()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={
          className ??
          'bg-brand-gradient inline-flex min-h-12 items-center gap-2.5 rounded-full px-7 font-semibold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
        }
      >
        {children ?? (
          <>
            <BookOpen className="size-5" aria-hidden="true" />
            Read the book
          </>
        )}
      </button>
      {open ? (
        <dialog
          ref={dialog}
          aria-label={title}
          onClose={() => setOpen(false)}
          onKeyDown={onKey}
          className="m-0 h-dvh overflow-hidden open:flex max-h-none w-screen max-w-none flex-col bg-[#14181f] p-0 text-white backdrop:bg-black/80"
        >
          <header className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
            <BookOpen
              className="hidden size-5 shrink-0 text-white/70 sm:block"
              aria-hidden="true"
            />
            <p className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold sm:text-base">
              {title}
            </p>
            <button
              type="button"
              onClick={share}
              aria-label={copied ? 'Link copied' : 'Share this book'}
              className={iconButton}
            >
              {copied ? (
                <Check className="size-5" aria-hidden="true" />
              ) : (
                <Share2 className="size-5" aria-hidden="true" />
              )}
            </button>
            <a
              href={downloadHref}
              download
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#14181f] transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14181f]"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sr-only sm:hidden">Download PDF</span>
            </a>
            <button
              type="button"
              data-close
              onClick={() => dialog.current?.close()}
              aria-label="Close the book"
              className={iconButton}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden px-2 pb-2 sm:px-6 sm:pb-4">
            <div ref={stage} className="ebook-stage size-full" />
            {status.kind === 'loading' ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80"
                role="status"
              >
                <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
                <p className="text-sm">
                  Opening the book
                  {status.progress != null ? ` · ${Math.round(status.progress * 100)}%` : '…'}
                </p>
              </div>
            ) : null}
            {status.kind === 'error' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <TriangleAlert className="size-8 text-amber-300" aria-hidden="true" />
                <p className="max-w-sm text-base font-semibold">
                  This book could not be opened here. You can still download the PDF.
                </p>
                <a
                  href={downloadHref}
                  download
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#14181f] transition-colors hover:bg-brand-soft"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download PDF
                </a>
              </div>
            ) : null}
          </div>

          <nav
            aria-label="Pages"
            className="flex items-center justify-center gap-2 px-3 pb-3 sm:gap-3 sm:pb-4"
          >
            <button
              type="button"
              onClick={() => book.current?.first()}
              disabled={!ready || ready.page <= 1}
              aria-label="First page"
              className={`${iconButton} hidden sm:inline-flex`}
            >
              <ChevronFirst className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => book.current?.prev()}
              disabled={!ready || ready.page <= 1}
              aria-label="Previous page"
              className={iconButton}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <p
              className="min-w-24 text-center text-sm tabular-nums text-white/80"
              aria-live="polite"
            >
              {ready ? `${ready.page} / ${ready.pages}` : ' '}
            </p>
            <button
              type="button"
              onClick={() => book.current?.next()}
              disabled={!ready || ready.page >= ready.pages}
              aria-label="Next page"
              className={iconButton}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => book.current?.last()}
              disabled={!ready || ready.page >= ready.pages}
              aria-label="Last page"
              className={`${iconButton} hidden sm:inline-flex`}
            >
              <ChevronLast className="size-5" aria-hidden="true" />
            </button>
          </nav>
        </dialog>
      ) : null}
    </>
  )
}
