import { ChevronDown, ChevronRight } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { isActive, isCurrent, type NavItem } from '@/lib/nav'
import { Brand } from '@/components/layout/Brand'
import { StuckSentinel } from '@/components/layout/StuckSentinel'
import type { SiteSetting } from '@/payload-types'

interface MainNavProps {
  items: NavItem[]
  pathname: string
  settings: SiteSetting
}

const RIGHT_ALIGNED = 3 // last N top-level menus open leftwards so they never overflow the viewport
const PANEL =
  'invisible absolute z-40 min-w-64 rounded-2xl border border-line/70 bg-card p-2 opacity-0 shadow-lift ring-1 ring-black/[0.03] transition duration-200'
// Panels touch their trigger (no margins): crossing a gap would drop :hover and close the menu.
const PANEL_LINK =
  'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-brand-soft hover:text-brand'

/**
 * Desktop menu bar (from `xl`, 1280px — the 11 Malayalam menus need ~1150px). Sticky, white, with an
 * underline for the active section. Dropdowns are pure CSS (hover + focus-within), so the whole menu
 * works — and is crawlable — without JavaScript. Below `xl` the MobileNav drawer is used instead.
 * Once the bar is stuck to the top (the masthead scrolled away) a compact logo appears at its left
 * and links home, so a plain "Home" menu item is left out of the bar.
 */
export function MainNav({ items, pathname, settings }: MainNavProps) {
  const isHome = (item: NavItem) =>
    item.href === '/' && !item.external && item.children.length === 0
  const menus = items.filter((item) => !isHome(item))
  return (
    <>
      <StuckSentinel />
      <div className="group/bar sticky top-0 z-30 hidden border-b border-line/60 bg-card/80 backdrop-blur-xl xl:block">
        <Container>
          <nav aria-label="Main menu">
            <ul className="-mx-2 flex items-center">
              <li className="hidden ps-2 group-data-[stuck=true]/bar:block">
                <Brand settings={settings} compact />
              </li>
              {menus.map((item, index) => {
                const alignRight = index >= menus.length - RIGHT_ALIGNED
                const active = isActive(item, pathname)
                return (
                  <li key={item.id} className={`group relative ${index === 0 ? 'ms-auto' : ''}`}>
                    <SmartLink
                      href={item.href}
                      external={item.external}
                      newTab={item.newTab}
                      aria-current={isCurrent(item, pathname) ? 'page' : undefined}
                      className={`relative my-1.5 flex min-h-10 items-center gap-0.5 whitespace-nowrap rounded-lg px-2 text-[0.84rem] font-semibold transition-colors ${active ? 'bg-brand text-white shadow-card' : 'text-ink hover:bg-brand-soft hover:text-brand'}`}
                    >
                      {item.label}
                      {item.children.length ? (
                        <ChevronDown
                          className="size-3 opacity-60 transition-transform group-hover:rotate-180"
                          aria-hidden="true"
                        />
                      ) : null}
                    </SmartLink>
                    {item.children.length ? (
                      <ul
                        className={`${PANEL} top-full translate-y-1 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 ${alignRight ? 'right-0' : 'left-0'}`}
                      >
                        {item.children.map((child) => (
                          <li key={child.id} className="group/sub relative">
                            <SmartLink
                              href={child.href}
                              external={child.external}
                              newTab={child.newTab}
                              className={PANEL_LINK}
                            >
                              {child.label}
                              {child.children.length ? (
                                <ChevronRight
                                  className="size-3.5 text-muted rtl:rotate-180"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </SmartLink>
                            {child.children.length ? (
                              <ul
                                className={`${PANEL} -top-1.5 min-w-56 group-focus-within/sub:visible group-focus-within/sub:opacity-100 group-hover/sub:visible group-hover/sub:opacity-100 ${alignRight ? 'right-full' : 'left-full'}`}
                              >
                                {child.children.map((grand) => (
                                  <li key={grand.id}>
                                    <SmartLink
                                      href={grand.href}
                                      external={grand.external}
                                      newTab={grand.newTab}
                                      className={PANEL_LINK}
                                    >
                                      {grand.label}
                                    </SmartLink>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </nav>
        </Container>
      </div>
    </>
  )
}
