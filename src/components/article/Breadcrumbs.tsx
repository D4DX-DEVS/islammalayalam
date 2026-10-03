import Link from 'next/link'
import { ChevronRight, House } from 'lucide-react'

export type Crumb = { label: string; href?: string | null }

/** Home › … › current. The last crumb is the current page (not a link). */
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ label: 'ഹോം', href: '/' }, ...items]
  return (
    <nav aria-label="ബ്രെഡ്ക്രംബ്" className={`mb-5 text-sm text-muted ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {all.map((c, i) => {
          const last = i === all.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 opacity-60 rtl:rotate-180"
                  aria-hidden="true"
                />
              ) : null}
              {!last && c.href ? (
                <Link
                  href={c.href}
                  className="inline-flex min-h-11 items-center gap-1 transition-colors hover:text-brand sm:min-h-0"
                >
                  {i === 0 ? <House className="size-3.5" aria-hidden="true" /> : null}
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'line-clamp-1 font-medium text-body' : ''}
                >
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
