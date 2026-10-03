import { ChevronDown, ChevronRight } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { isActive, isCurrent, type NavItem } from '@/lib/nav'

interface MainNavProps {
  items: NavItem[]
  pathname: string
}

const RIGHT_ALIGNED = 3 // last N top-level menus open leftwards so they never overflow the viewport
const PANEL =
  'invisible absolute z-40 min-w-60 rounded-xl border border-line bg-card p-1.5 opacity-0 shadow-lift transition duration-150'
// Panels touch their trigger (no margins): crossing a gap would drop :hover and close the menu.
const PANEL_LINK =
  'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-body transition-colors hover:bg-surface hover:text-brand'

/**
 * Desktop menu bar (from `xl`, 1280px — the 11 Malayalam menus need ~1150px). Sticky, white, with an
 * underline for the active section. Dropdowns are pure CSS (hover + focus-within), so the whole menu
 * works — and is crawlable — without JavaScript. Below `xl` the MobileNav drawer is used instead.
 */
export function MainNav({ items, pathname }: MainNavProps) {
  return (
    <div className="sticky top-0 z-30 hidden border-b border-line bg-card/90 backdrop-blur-md xl:block">
      <Container>
        <nav aria-label="പ്രധാന മെനു">
          <ul className="-mx-2 flex">
            {items.map((item, index) => {
              const alignRight = index >= items.length - RIGHT_ALIGNED
              const active = isActive(item, pathname)
              return (
                <li key={item.id} className="group relative">
                  <SmartLink
                    href={item.href}
                    external={item.external}
                    newTab={item.newTab}
                    aria-current={isCurrent(item, pathname) ? 'page' : undefined}
                    className={`relative flex min-h-12 items-center gap-0.5 whitespace-nowrap px-2 text-[0.84rem] font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors hover:text-brand ${active ? 'text-brand after:bg-brand' : 'text-ink after:bg-transparent'}`}
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
  )
}
