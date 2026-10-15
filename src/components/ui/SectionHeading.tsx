import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface SectionHeadingProps {
  title: string
  href?: string | null
  as?: 'h1' | 'h2' | 'h3'
  moreLabel?: string
  /** `dark` = on the royal-blue video band. */
  tone?: 'default' | 'dark'
  /** Replaces the gold bar (e.g. the gold play badge of the video band). */
  icon?: ReactNode
  className?: string
}

/** Section title with a gold bar, and an optional "see all" link that slides its arrow on hover. */
export function SectionHeading({
  title,
  href,
  as: Tag = 'h2',
  moreLabel = 'View More',
  tone = 'default',
  icon,
  className = '',
}: SectionHeadingProps) {
  const dark = tone === 'dark'
  return (
    <div
      data-reveal="fade"
      className={`mb-5 flex items-center justify-between gap-4 sm:mb-6 ${className}`}
    >
      <Tag
        className={`flex min-w-0 items-center gap-3 text-xl font-bold leading-normal sm:text-[1.65rem] ${dark ? 'text-white' : 'text-title'}`}
      >
        {icon ? (
          <span className="title-icon inline-flex shrink-0">{icon}</span>
        ) : (
          <span
            className="title-bar h-7 w-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
        <span className="title-text min-w-0">{title}</span>
      </Tag>
      {href ? (
        <Link
          href={href}
          className={`title-link group inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors ${dark ? 'text-white hover:text-accent' : 'text-brand hover:text-brand-strong'}`}
        >
          {moreLabel}
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  )
}
