import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Newspaper, type LucideIcon } from 'lucide-react'

interface SectionHeadingProps {
  title: string
  href?: string | null
  as?: 'h1' | 'h2' | 'h3'
  moreLabel?: string
  /** The "more" link leaves the site (opens in a new tab). */
  external?: boolean
  /** Controls shown at the end of the row, before the "more" link (e.g. a slider's arrows). */
  actions?: ReactNode
  /** `dark` = on the royal-blue video band. */
  tone?: 'default' | 'dark'
  /** The lucide icon in the badge before the title; the news icon when a section names none. */
  icon?: LucideIcon
  /** Colour of the badge: blue by default, red for YouTube content, gold on the dark bands. */
  tint?: 'brand' | 'red'
  className?: string
}

/** The badge: a soft gradient rounded square with the icon in white (gold with a navy icon on dark bands). */
const BADGE = {
  brand:
    'bg-gradient-to-br from-brand to-brand-strong text-white shadow-[0_6px_14px_-6px_rgb(11_107_211/0.7)]',
  red: 'bg-gradient-to-br from-[#f04452] to-[#c8102e] text-white shadow-[0_6px_14px_-6px_rgb(200_16_46/0.7)]',
  gold: 'bg-gradient-to-br from-[#ffd24d] to-[#f0a400] text-brand-deep shadow-[0_6px_14px_-6px_rgb(240_164_0/0.7)]',
} as const

/** Section title with an icon badge, and an optional "see all" link that slides its arrow on hover. */
export function SectionHeading({
  title,
  href,
  as: Tag = 'h2',
  moreLabel = 'View More',
  external = false,
  actions,
  tone = 'default',
  icon: Icon = Newspaper,
  tint = 'brand',
  className = '',
}: SectionHeadingProps) {
  const dark = tone === 'dark'
  return (
    <div
      data-reveal="fade"
      suppressHydrationWarning
      className={`mb-5 flex items-center justify-between gap-4 sm:mb-6 ${className}`}
    >
      <Tag
        className={`flex min-w-0 items-center gap-3 text-lg font-normal leading-normal sm:text-[1.3rem] ${dark ? 'text-white' : 'text-title'}`}
      >
        <span
          className={`title-icon inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${BADGE[dark ? 'gold' : tint]}`}
          aria-hidden="true"
        >
          <Icon className="size-[1.2rem]" strokeWidth={2.1} />
        </span>
        <span className="title-text min-w-0">{title}</span>
      </Tag>
      {href || actions ? (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {href ? (
            <Link
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
      ) : null}
    </div>
  )
}
