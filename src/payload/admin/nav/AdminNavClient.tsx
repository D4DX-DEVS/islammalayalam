'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConfig } from '@payloadcms/ui'
import {
  ArrowRightLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  File,
  FileText,
  FolderTree,
  Globe,
  Headphones,
  History,
  Images,
  Inbox,
  Megaphone,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Newspaper,
  PanelBottom,
  PanelTop,
  Quote,
  ScrollText,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserPen,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

import type { NavGroupData, NavItemData } from './navModel'

type NavUser = { name: string; email: string; role: string }

const ICONS: Record<string, LucideIcon> = {
  posts: Newspaper,
  pages: FileText,
  categories: FolderTree,
  authors: UserPen,
  quotes: Quote,
  audios: Headphones,
  videos: Video,
  media: Images,
  redirects: ArrowRightLeft,
  'contact-messages': Inbox,
  'postal-requests': BookOpen,
  users: Users,
  'audit-logs': ScrollText,
  'migration-runs': History,
  'migration-issues': TriangleAlert,
  'site-settings': Settings,
  'security-settings': ShieldCheck,
  header: PanelTop,
  homepage: LayoutTemplate,
  footer: PanelBottom,
  'ads-banners': Megaphone,
  website: Globe,
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const STORAGE_KEY = 'im-nav-tucked-open'
const SCROLL_KEY = 'im-nav-scroll'
// useLayoutEffect warns during SSR; the scroll restore only matters in the browser.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function readScroll(): number {
  try {
    return Number(window.sessionStorage.getItem(SCROLL_KEY)) || 0
  } catch {
    return 0
  }
}

function writeScroll(top: number): void {
  try {
    window.sessionStorage.setItem(SCROLL_KEY, String(Math.round(top)))
  } catch {
    // Blocked storage: the sidebar simply starts at the top.
  }
}

function readOpen(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeOpen(keys: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Private mode / blocked storage: opening still works for this page view.
  }
}

const initials = (user: NavUser): string =>
  (user.name || user.email || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

const badgeText = (n: number): string => (n > 99 ? '99+' : String(n))

export function AdminNavClient({ groups, user }: { groups: NavGroupData[]; user: NavUser }) {
  const pathname = usePathname()
  const { config } = useConfig()
  const admin = config.routes.admin
  const logout = `${admin}${config.admin.routes.logout ?? '/logout'}`
  const [open, setOpen] = useState<string[]>([])
  const navRef = useRef<HTMLElement>(null)

  // Payload re-renders the sidebar on every page, which would jump it back to the top. Keep its
  // scroll position for the tab, and make sure the page you are on is always visible in it.
  useBrowserLayoutEffect(() => {
    const scroller = navRef.current?.closest<HTMLElement>('.nav__scroll')
    if (!scroller) return
    scroller.scrollTop = readScroll()
    const current = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (current) {
      const box = scroller.getBoundingClientRect()
      const item = current.getBoundingClientRect()
      if (item.top < box.top || item.bottom > box.bottom)
        current.scrollIntoView({ block: 'center' })
    }
    const save = () => writeScroll(scroller.scrollTop)
    scroller.addEventListener('scroll', save, { passive: true })
    return () => scroller.removeEventListener('scroll', save)
  }, [pathname])

  useEffect(() => {
    // Restored after mount so server and client render the same markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(readOpen())
  }, [])

  const toggle = (key: string) => {
    const next = open.includes(key) ? open.filter((k) => k !== key) : [...open, key]
    setOpen(next)
    writeOpen(next)
  }

  const hrefFor = (item: NavItemData) => `${admin}${item.href}`
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const itemActive = (item: NavItemData) =>
    [item.href, ...(item.also ?? [])].some((path) => isActive(`${admin}${path}`))

  const renderItem = (item: NavItemData) => {
    const href = hrefFor(item)
    const Icon = ICONS[item.slug] ?? File
    return (
      <li key={item.key}>
        <Link
          href={href}
          prefetch={false}
          className="im-nav__link"
          aria-current={itemActive(item) ? 'page' : undefined}
        >
          <Icon aria-hidden="true" />
          <span className="im-nav__text">{item.label}</span>
          {item.badge ? (
            <span className="im-nav__badge">
              {badgeText(item.badge)}
              <span className="im-nav__sr"> waiting</span>
            </span>
          ) : null}
        </Link>
      </li>
    )
  }

  return (
    <nav ref={navRef} className="nav__wrap im-nav" aria-label="Admin">
      <Link href={admin} className="im-nav__brand">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/brand/icon-192.png" alt="" width={36} height={36} />
        <span>
          <span className="im-nav__brand-name">Islam Malayalam</span>
          <span className="im-nav__brand-sub">Content admin</span>
        </span>
      </Link>

      <ul className="im-nav__list">
        <li>
          <Link
            href={admin}
            className="im-nav__link"
            aria-current={pathname === admin ? 'page' : undefined}
          >
            <LayoutDashboard aria-hidden="true" />
            <span className="im-nav__text">Dashboard</span>
          </Link>
        </li>
      </ul>

      {groups.map((group) => {
        const id = `im-nav-group-${group.key}`
        if (group.tucked) {
          const expanded = open.includes(group.key)
          return (
            <div key={group.key} className="im-nav__group im-nav__group--tucked">
              <button
                type="button"
                className="im-nav__link im-nav__tuck"
                aria-expanded={expanded}
                aria-controls={id}
                onClick={() => toggle(group.key)}
              >
                <ChevronRight aria-hidden="true" data-open={expanded} />
                <span className="im-nav__text">{group.label}</span>
                <span className="im-nav__tag">Rarely used</span>
              </button>
              {expanded ? (
                <ul id={id} className="im-nav__list">
                  {group.items.map(renderItem)}
                </ul>
              ) : null}
            </div>
          )
        }
        return (
          <div key={group.key} className="im-nav__group" role="group" aria-labelledby={`${id}-h`}>
            <p id={`${id}-h`} className="im-nav__group-label">
              {group.label}
            </p>
            <ul id={id} className="im-nav__list">
              {group.items.map(renderItem)}
            </ul>
          </div>
        )
      })}

      <div className="im-nav__footer">
        <a href="/" target="_blank" rel="noopener noreferrer" className="im-nav__link">
          <ExternalLink aria-hidden="true" />
          <span className="im-nav__text">View website</span>
        </a>
        <div className="im-nav__user">
          <Link href={`${admin}/account`} className="im-nav__user-link" title="Your account">
            <span className="im-nav__avatar" aria-hidden="true">
              {initials(user)}
            </span>
            <span className="im-nav__user-text">
              <span className="im-nav__user-name">{user.name || user.email}</span>
              <span className="im-nav__user-role">{ROLE_LABEL[user.role] ?? 'Staff'}</span>
            </span>
          </Link>
          {/* data-im-sign-out: AdminEnhancements asks for confirmation first. */}
          <Link
            href={logout}
            className="im-nav__logout"
            aria-label="Sign out"
            title="Sign out"
            data-im-sign-out=""
          >
            <LogOut aria-hidden="true" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
