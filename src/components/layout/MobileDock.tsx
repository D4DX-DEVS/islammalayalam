'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AudioLines, House, Lightbulb, Menu, Search, type LucideIcon } from 'lucide-react'
import { SocialIcon } from '@/components/layout/SocialLinks'
import { SEARCH_PATH } from '@/components/layout/SearchForm'
import { OPEN_MOBILE_NAV } from '@/lib/pwa'

interface DockLink {
  href: string
  label: string
  icon: LucideIcon
  /** Active for the exact path only (Home), else for the whole section. */
  exact?: boolean
}

const LINKS: DockLink[] = [
  { href: '/', label: 'Home', icon: House, exact: true },
  { href: '/insights/', label: 'Insights', icon: Lightbulb },
  { href: SEARCH_PATH, label: 'Search', icon: Search },
  { href: '/audios/', label: 'Audios', icon: AudioLines },
]

const ITEM =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.68rem] font-semibold transition-colors'

/**
 * App-style bottom bar below `xl`: Home · Insights · Search · Audios · Ask (WhatsApp) · Menu (opens
 * the MobileNav drawer). Hides while scrolling down with the header (globals.css, `data-scroll`)
 * and respects the iPhone home-indicator inset.
 */
export function MobileDock({ whatsapp }: { whatsapp?: string | null }) {
  const pathname = usePathname() ?? '/'
  const active = (l: DockLink) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href)
  return (
    <nav
      aria-label="Quick menu"
      className="mobile-dock fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-card/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(13_52_120/0.35)] backdrop-blur-xl xl:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch gap-1">
        {LINKS.map((l) => {
          const on = active(l)
          const Icon = l.icon
          return (
            <li key={l.href} className="flex flex-1">
              <Link
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className={`${ITEM} ${on ? 'text-brand' : 'text-muted hover:text-brand'}`}
              >
                <span
                  className={`inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors ${on ? 'bg-brand-soft' : ''}`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {l.label}
              </Link>
            </li>
          )
        })}
        {whatsapp ? (
          <li className="flex flex-1">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ask a Question on WhatsApp"
              className={`${ITEM} text-[#0a8443] hover:text-[#096f39] dark:text-[#25d366]`}
            >
              <span className="inline-flex h-7 w-12 items-center justify-center">
                <SocialIcon network="whatsapp" className="size-5" />
              </span>
              Ask
            </a>
          </li>
        ) : null}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_MOBILE_NAV))}
            aria-controls="mobile-menu"
            className={`${ITEM} text-muted hover:text-brand`}
          >
            <span className="inline-flex h-7 w-12 items-center justify-center">
              <Menu className="size-5" aria-hidden="true" />
            </span>
            Menu
          </button>
        </li>
      </ul>
    </nav>
  )
}
