'use client'

import { useEffect, useState } from 'react'
import { useNav } from '@payloadcms/ui'

const DRAWER_QUERY = '(max-width: 1024px)'

/**
 * The <aside class="nav"> around the sidebar, in place of Payload's NavWrapper. Payload treats the
 * sidebar as closed on every screen up to 1440px and makes it inert until a hamburger opens it;
 * this admin shows it from 1025px up regardless (nav.scss), so the aside is only ever inert while
 * it is a closed drawer on a smaller screen. Payload's open/close state and class names are kept,
 * so its drawer, the phone menu sheet and the header hamburger keep working.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const { hydrated, navOpen, navRef, shouldAnimate } = useNav()
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(DRAWER_QUERY)
    const apply = () => setDrawer(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  const className = [
    'nav',
    navOpen && 'nav--nav-open',
    shouldAnimate && 'nav--nav-animate',
    hydrated && 'nav--nav-hydrated',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={className} inert={drawer && !navOpen ? true : undefined}>
      <div className="nav__scroll" ref={navRef}>
        {children}
      </div>
    </aside>
  )
}
