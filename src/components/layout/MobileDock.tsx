'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Headphones, House, LayoutGrid, Lightbulb, Search, type LucideIcon } from 'lucide-react'
import { SocialIcon } from '@/components/layout/SocialLinks'
import { SEARCH_PATH } from '@/components/layout/SearchForm'
import { activeTab, type DockTarget } from '@/lib/dock'
import { OPEN_MOBILE_NAV } from '@/lib/pwa'

interface DockLink extends DockTarget {
  href: string
  label: string
  icon: LucideIcon
}

const LINKS: DockLink[] = [
  { href: '/', label: 'Home', icon: House, exact: true },
  { href: '/insights/', label: 'Insights', icon: Lightbulb },
  { href: '/audios/', label: 'Audios', icon: Headphones },
  { href: SEARCH_PATH, label: 'Search', icon: Search },
]

const ITEM =
  'dock-item flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[0.68rem] font-semibold transition-colors'

/**
 * App-style bottom bar below `xl`: a floating glass bar (Home · Insights · Audios · Search · Menu,
 * the last opening the MobileNav drawer) with a highlight that slides to the current tab, and
 * WhatsApp ("Ask a Question") as its own round button beside it. Hides while scrolling down with the
 * header (globals.css, `data-scroll`) and sits above the iPhone home indicator.
 */
export function MobileDock({ whatsapp }: { whatsapp?: string | null }) {
  const current = activeTab(usePathname() ?? '/', LINKS)
  const count = LINKS.length + 1
  return (
    <nav
      aria-label="Quick menu"
      className="mobile-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] xl:hidden"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2">
        <div
          className="dock-bar relative min-w-0 flex-1 rounded-full bg-card/80 p-1.5 ring-1 ring-line/70 backdrop-blur-xl backdrop-saturate-150"
          style={{ '--count': count } as CSSProperties}
        >
          {current >= 0 ? (
            <span
              className="dock-pill bg-brand-soft"
              style={{ '--i': current } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}
          <ul className="relative flex items-stretch">
            {LINKS.map((l, i) => {
              const on = i === current
              const Icon = l.icon
              return (
                <li key={l.href} className="flex min-w-0 flex-1">
                  <Link
                    href={l.href}
                    aria-current={on ? 'page' : undefined}
                    className={`${ITEM} ${on ? 'text-brand' : 'text-muted hover:text-ink'}`}
                  >
                    <Icon className="size-5" strokeWidth={on ? 2.4 : 1.9} aria-hidden="true" />
                    {l.label}
                  </Link>
                </li>
              )
            })}
            <li className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_MOBILE_NAV))}
                aria-controls="mobile-menu"
                className={`${ITEM} text-muted hover:text-ink`}
              >
                <LayoutGrid className="size-5" strokeWidth={1.9} aria-hidden="true" />
                Menu
              </button>
            </li>
          </ul>
        </div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ask a Question on WhatsApp"
            className="dock-bar inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-[#0a8443] text-white ring-1 ring-black/5 transition hover:bg-[#096f39] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a8443]"
          >
            <SocialIcon network="whatsapp" className="size-7" />
          </a>
        ) : null}
      </div>
    </nav>
  )
}
