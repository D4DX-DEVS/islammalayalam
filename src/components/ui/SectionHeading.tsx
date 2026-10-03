import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface SectionHeadingProps {
  title: string
  href?: string | null
  as?: 'h1' | 'h2' | 'h3'
  moreLabel?: string
  /** `dark` = on the navy video band. */
  tone?: 'default' | 'dark'
  className?: string
}

/** Section title with a brand bar, a hairline, and an optional "see all" pill link. */
export function SectionHeading({
  title,
  href,
  as: Tag = 'h2',
  moreLabel = 'എല്ലാം കാണുക',
  tone = 'default',
  className = '',
}: SectionHeadingProps) {
  const dark = tone === 'dark'
  return (
    <div className={`mb-5 flex items-center gap-3 sm:mb-6 ${className}`}>
      <Tag
        className={`flex min-w-0 items-center gap-2.5 text-xl font-bold leading-normal sm:text-2xl ${dark ? 'text-white' : 'text-ink'}`}
      >
        <span
          className={`h-6 w-1.5 shrink-0 rounded-full ${dark ? 'bg-sky-300' : 'bg-brand'}`}
          aria-hidden="true"
        />
        {title}
      </Tag>
      <span
        className={`h-px min-w-3 flex-1 ${dark ? 'bg-white/15' : 'bg-line'}`}
        aria-hidden="true"
      />
      {href ? (
        <Link
          href={href}
          className={`group -me-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-semibold transition-colors sm:me-0 sm:min-h-9 sm:gap-1.5 sm:px-3.5 ${dark ? 'text-white hover:bg-white/10' : 'text-brand hover:bg-brand-soft'}`}
        >
          {moreLabel}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  )
}
