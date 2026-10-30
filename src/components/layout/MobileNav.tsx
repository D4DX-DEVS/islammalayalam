'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ChevronRight, House, X } from 'lucide-react'
import { SmartLink } from '@/components/ui/SmartLink'
import { SearchForm } from '@/components/layout/SearchForm'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { isActive, isCurrent, uniqueNavGroups, type NavGroup, type NavItem } from '@/lib/nav'
import { OPEN_MOBILE_NAV } from '@/lib/pwa'
import type { SiteSetting } from '@/payload-types'

interface MobileNavProps {
  items: NavItem[]
  /** The footer's link columns (Quick Links …), listed under the menu; the footer hides them on phones. */
  quickLinks?: NavGroup[]
  pathname: string
  topLinks: NavItem[]
  social: SiteSetting['social']
  siteName: string
  tagline?: string | null
  aiSearch?: boolean
}

const ROW =
  'flex min-h-13 w-full items-center gap-3 rounded-xl px-3.5 text-start text-[0.98rem] font-semibold transition-colors active:scale-[0.98]'

/** One row: a link, or (with children) a button that opens the section's own page. */
function Row({
  item,
  pathname,
  onOpen,
}: {
  item: NavItem
  pathname: string
  onOpen: (item: NavItem) => void
}) {
  const current = isCurrent(item, pathname)
  const tone = current || isActive(item, pathname) ? 'text-brand' : 'text-ink'
  const home = item.href === '/' && !item.external
  if (item.children.length)
    return (
      <button type="button" onClick={() => onOpen(item)} className={`${ROW} ${tone} hover:bg-card`}>
        <span className="min-w-0 flex-1">{item.label}</span>
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-muted">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </span>
      </button>
    )
  return (
    <SmartLink
      href={item.href}
      external={item.external}
      newTab={item.newTab}
      aria-current={current ? 'page' : undefined}
      className={`${ROW} ${current ? 'bg-brand-soft text-brand' : `${tone} hover:bg-card`}`}
    >
      {home ? <House className="size-5 shrink-0" aria-hidden="true" /> : null}
      {item.label}
    </SmartLink>
  )
}

/**
 * Slide-in drawer (below `xl`), opened by the bottom dock's Menu button. Sections drill down like a phone's settings: a
 * section with sub-menus opens its own page (back arrow, "View all", its items) instead of nesting
 * accordions. Escape/overlay/route change close it; focus returns to the opener.
 * The drawer is portalled to <body>: the sticky header uses backdrop-blur, and a backdrop-filter ancestor
 * becomes the containing block for `position: fixed`, which squeezed the drawer into the header's 64px.
 */
export function MobileNav({
  items,
  quickLinks = [],
  pathname: initialPath,
  topLinks,
  social,
  siteName,
  tagline,
  aiSearch = false,
}: MobileNavProps) {
  const [open, setOpen] = useState(false)
  // Drill-down path: [] = top level; each entry is a section whose children are shown.
  const [trail, setTrail] = useState<NavItem[]>([])
  const [back, setBack] = useState(false)
  const pathname = usePathname() ?? initialPath
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [lastPath, setLastPath] = useState(pathname)

  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  const show = () => {
    setTrail([])
    setOpen(true)
  }
  const push = (item: NavItem) => {
    setBack(false)
    setTrail((t) => [...t, item])
  }
  const pop = () => {
    setBack(true)
    setTrail((t) => t.slice(0, -1))
  }

  // The bottom dock's Menu button opens the same drawer.
  useEffect(() => {
    window.addEventListener(OPEN_MOBILE_NAV, show)
    return () => window.removeEventListener(OPEN_MOBILE_NAV, show)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    // Focus goes back to whatever opened the drawer (the dock's Menu button).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open])

  // Each drill step starts at the top of the list, with focus on its first control.
  useEffect(() => {
    if (!open || !trail.length) return
    listRef.current?.scrollTo({ top: 0 })
    listRef.current?.querySelector<HTMLElement>('button, a')?.focus()
  }, [open, trail])

  const section = trail.at(-1)
  const list = section ? section.children : items
  // Highlighted header links stay pinned as buttons; the plain ones (About Us …) join the list.
  const actions = topLinks.filter((l) => l.highlight)
  const pageLinks =
    uniqueNavGroups(
      [{ id: 'top', title: '', links: topLinks.filter((l) => !l.highlight) }],
      items,
    )[0]?.links ?? []
  const groups = uniqueNavGroups(quickLinks, [...items, ...topLinks])

  return open
    ? createPortal(
        <div className="fixed inset-0 z-50" id="mobile-menu">
          <div
            className="drawer-fade absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="drawer-in absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col overflow-hidden rounded-e-3xl bg-card shadow-lift"
          >
            <div className="space-y-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="flex min-h-12 items-center gap-3">
                <Image
                  src="/brand/icon-192.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-display font-bold text-ink">{siteName}</span>
                  {tagline ? (
                    <span className="block truncate text-xs text-muted">{tagline}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="-me-1 inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <SearchForm ai={aiSearch} />
            </div>
            <nav
              ref={listRef}
              aria-label="Mobile menu"
              className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div
                key={trail.map((t) => t.id).join('/')}
                className={trail.length || back ? (back ? 'drill-back' : 'drill-in') : ''}
              >
                {section ? (
                  <div className="mb-2 flex items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={pop}
                      aria-label="Back"
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
                    >
                      <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
                    </button>
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">
                      {section.label}
                    </span>
                    {section.href ? (
                      <SmartLink
                        href={section.href}
                        external={section.external}
                        newTab={section.newTab}
                        className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft"
                      >
                        View all
                      </SmartLink>
                    ) : null}
                  </div>
                ) : null}
                <ul className="space-y-0.5 rounded-2xl bg-surface p-1.5">
                  {list.map((item) => (
                    <li key={item.id}>
                      <Row item={item} pathname={pathname} onOpen={push} />
                    </li>
                  ))}
                </ul>
                {section || !pageLinks.length ? null : (
                  <ul className="mt-4 space-y-0.5 rounded-2xl bg-surface p-1.5">
                    {pageLinks.map((item) => (
                      <li key={item.id}>
                        <Row item={item} pathname={pathname} onOpen={push} />
                      </li>
                    ))}
                  </ul>
                )}
                {section
                  ? null
                  : groups.map((group) => (
                      <section key={group.id} aria-labelledby={`menu-${group.id}`} className="mt-4">
                        <h2
                          id={`menu-${group.id}`}
                          className="px-3 pb-1.5 text-sm font-semibold text-muted"
                        >
                          {group.title}
                        </h2>
                        <ul className="space-y-0.5 rounded-2xl bg-surface p-1.5">
                          {group.links.map((item) => (
                            <li key={item.id}>
                              <Row item={item} pathname={pathname} onOpen={push} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
              </div>
            </nav>
            <div className="grid grid-cols-2 gap-2 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
              {actions.map((l) => (
                <SmartLink
                  key={l.id}
                  href={l.href}
                  external={l.external}
                  newTab={l.newTab}
                  className="inline-flex min-h-11 items-center justify-center truncate whitespace-nowrap rounded-xl bg-accent-strong px-2 text-sm font-semibold text-on-accent transition-transform last:odd:col-span-2 hover:opacity-90 active:scale-[0.97]"
                >
                  {l.label}
                </SmartLink>
              ))}
              <SocialLinks social={social} variant="brand" className="col-span-2 justify-center" />
            </div>
          </div>
        </div>,
        document.body,
      )
    : null
}
