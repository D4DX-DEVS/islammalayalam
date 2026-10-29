'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, useConfig, useNav } from '@payloadcms/ui'
import { LayoutDashboard, LayoutGrid, Newspaper, Plus } from 'lucide-react'
import { activeTab, type DockTarget } from '@/lib/dock'
import { nextScrollDir, type ScrollDir } from '@/lib/pwa'
import { InboxBell } from '../header/InboxBell'

type Tab = DockTarget & { key: 'home' | 'posts' | 'new' | 'inbox' | 'menu' }

/**
 * The admin's bottom bar on phones (admin.components.header; shown up to 768 px, where Payload's
 * side menu becomes a drawer): Home · Posts · New post · Inbox · Menu, the last opening that drawer.
 * The same floating glass bar as the site's MobileDock, with a highlight that slides to the current
 * section. Only offers what this role may open, and steps aside while scrolling down, while typing
 * and while the menu is open (admin-dock.scss).
 */
export function AdminDock() {
  const { config } = useConfig()
  const { permissions } = useAuth()
  const { navOpen, setNavOpen } = useNav()
  const pathname = usePathname() ?? ''
  const [scroll, setScroll] = useState<ScrollDir>('up')

  useEffect(() => {
    let dir: ScrollDir = 'up'
    let lastY = window.scrollY
    let frame = 0
    const apply = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const next = nextScrollDir(dir, lastY, y)
      if (next !== dir || Math.abs(y - lastY) >= 8) lastY = y
      if (next !== dir) setScroll((dir = next))
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const hidden = scroll === 'down' || navOpen
  // Bottom-pinned Payload bars (bulk actions, toasts) follow it: admin-dock.scss, --im-dock-h.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.imDock = hidden ? 'hidden' : 'shown'
    return () => {
      delete root.dataset.imDock
    }
  }, [hidden])

  const admin = config.routes.admin
  const collections = permissions?.collections
  const posts = collections?.posts
  const inbox = collections?.['contact-messages']?.read || collections?.['postal-requests']?.read
  const tabs: Tab[] = [
    { key: 'home', href: admin, exact: true },
    ...(posts?.read ? [{ key: 'posts', href: `${admin}/collections/posts` } as const] : []),
    ...(posts?.create ? [{ key: 'new' } as const] : []),
    ...(inbox
      ? [
          {
            key: 'inbox',
            href: `${admin}/collections/contact-messages`,
            also: [`${admin}/collections/postal-requests`],
          } as const,
        ]
      : []),
    { key: 'menu' },
  ]
  const current = activeTab(pathname, tabs)

  const item = (tab: Tab, on: boolean) => {
    switch (tab.key) {
      case 'home':
      case 'posts': {
        const Icon = tab.key === 'home' ? LayoutDashboard : Newspaper
        return (
          <Link
            href={tab.href ?? admin}
            className="im-dock__item"
            aria-current={on ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            {tab.key === 'home' ? 'Home' : 'Posts'}
          </Link>
        )
      }
      case 'new':
        return (
          <Link
            href={`${admin}/collections/posts/create`}
            className="im-dock__item"
            aria-label="New post"
            title="New post"
          >
            <span className="im-dock__new">
              <Plus aria-hidden="true" />
            </span>
          </Link>
        )
      case 'inbox':
        return <InboxBell variant="dock" active={on} />
      case 'menu':
        return (
          <button
            type="button"
            className="im-dock__item"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <LayoutGrid aria-hidden="true" />
            Menu
          </button>
        )
    }
  }

  return (
    <nav className="im-dock" aria-label="Quick menu" data-hidden={hidden ? '' : undefined}>
      <div className="im-dock__bar" style={{ '--count': tabs.length } as CSSProperties}>
        {current >= 0 ? (
          <span
            className="im-dock__pill"
            style={{ '--i': current } as CSSProperties}
            aria-hidden="true"
          />
        ) : null}
        <ul className="im-dock__list">
          {tabs.map((tab, i) => (
            <li key={tab.key}>{item(tab, i === current)}</li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
