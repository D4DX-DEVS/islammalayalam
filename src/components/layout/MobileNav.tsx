'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, X } from 'lucide-react'
import { SmartLink } from '@/components/ui/SmartLink'
import { SearchForm } from '@/components/layout/SearchForm'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { isActive, isCurrent, type NavItem } from '@/lib/nav'
import type { SiteSetting } from '@/payload-types'

interface MobileNavProps {
  items: NavItem[]
  pathname: string
  topLinks: NavItem[]
  social: SiteSetting['social']
}

function Branch({ item, depth, pathname }: { item: NavItem; depth: number; pathname: string }) {
  const [open, setOpen] = useState(() => item.children.length > 0 && isActive(item, pathname))
  const current = isCurrent(item, pathname)
  const pad = depth === 0 ? 'ps-3' : depth === 1 ? 'ps-6' : 'ps-9'
  const row = `flex min-h-12 flex-1 items-center rounded-lg ${pad} pe-2 text-start ${depth === 0 ? 'text-[0.98rem] font-semibold' : 'text-[0.93rem]'} ${current ? 'bg-brand-soft text-brand' : depth === 0 ? 'text-ink' : 'text-body'}`
  return (
    <li>
      <div className="flex items-stretch gap-1">
        {item.href ? (
          <SmartLink
            href={item.href}
            external={item.external}
            newTab={item.newTab}
            aria-current={current ? 'page' : undefined}
            className={`${row} hover:text-brand`}
          >
            {item.label}
          </SmartLink>
        ) : (
          <button
            type="button"
            className={row}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {item.label}
          </button>
        )}
        {item.children.length ? (
          <button
            type="button"
            className="inline-flex min-h-12 w-12 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-brand"
            aria-expanded={open}
            aria-label={`${item.label} — ഉപമെനു`}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown
              className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      {item.children.length && open ? (
        <ul className="my-1 space-y-0.5 border-s-2 border-brand-soft ms-3">
          {item.children.map((child) => (
            <Branch key={child.id} item={child} depth={depth + 1} pathname={pathname} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * Menu button + slide-in drawer (below `xl`). Escape/overlay/route change close it; focus returns to the button.
 * The drawer is portalled to <body>: the sticky header uses backdrop-blur, and a backdrop-filter ancestor
 * becomes the containing block for `position: fixed`, which squeezed the drawer into the header's 64px.
 */
export function MobileNav({ items, pathname: initialPath, topLinks, social }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? initialPath
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [lastPath, setLastPath] = useState(pathname)

  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    const toggle = toggleRef.current
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
      toggle?.focus()
    }
  }, [open])

  return (
    <div className="-ms-2 xl:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface hover:text-brand"
      >
        <Menu className="size-6" aria-hidden="true" />
        <span className="sr-only">മെനു</span>
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50" id="mobile-menu">
              <div
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                aria-hidden="true"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="മെനു"
                className="absolute inset-y-0 start-0 flex w-[88%] max-w-sm flex-col rounded-e-3xl bg-card shadow-lift"
              >
                <div className="flex min-h-16 items-center justify-between px-5">
                  <span className="font-display text-lg font-bold text-ink">മെനു</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="മെനു അടയ്ക്കുക"
                    className="-me-2 inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface"
                  >
                    <X className="size-6" aria-hidden="true" />
                  </button>
                </div>
                <SearchForm className="px-4 pb-3" />
                <nav
                  aria-label="മൊബൈൽ മെനു"
                  className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
                >
                  <ul className="space-y-0.5">
                    {items.map((item) => (
                      <Branch key={item.id} item={item} depth={0} pathname={pathname} />
                    ))}
                  </ul>
                </nav>
                <div className="space-y-3 border-t border-line px-5 py-4">
                  {topLinks.length ? (
                    <ul className="flex flex-wrap gap-x-5 gap-y-1">
                      {topLinks.map((l) => (
                        <li key={l.id}>
                          <SmartLink
                            href={l.href}
                            external={l.external}
                            newTab={l.newTab}
                            className="inline-flex min-h-11 items-center text-sm font-medium text-muted hover:text-brand"
                          >
                            {l.label}
                          </SmartLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <SocialLinks social={social} size="md" className="-ms-2 text-muted" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
