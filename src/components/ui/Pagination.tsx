import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageWindow } from '@/lib/pagination'

interface PaginationProps {
  basePath: string
  page: number
  totalPages: number
  query?: Record<string, string>
}

function pageHref(basePath: string, page: number, query: Record<string, string> = {}): string {
  const params = new URLSearchParams(query)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

const ITEM =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition'
const IDLE = `${ITEM} text-body hover:bg-brand-soft hover:text-brand`
const EDGE = `${IDLE} bg-card ring-1 ring-line shadow-card`

/** Server-rendered pagination (?page=N). Works without JavaScript; crawlable. */
export function Pagination({ basePath, page, totalPages, query }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pages" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={pageHref(basePath, page - 1, query)}
          rel="prev"
          className={EDGE}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}
      {pageWindow(page, totalPages).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={pageHref(basePath, n, query)}
            aria-current={n === page ? 'page' : undefined}
            className={n === page ? `${ITEM} bg-brand-gradient text-white shadow-lift` : IDLE}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          href={pageHref(basePath, page + 1, query)}
          rel="next"
          className={EDGE}
          aria-label="Next page"
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  )
}
