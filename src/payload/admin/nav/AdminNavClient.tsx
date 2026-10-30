'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useConfig } from '@payloadcms/ui'
import {
  ArrowRightLeft,
  BookMarked,
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
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  LogOut,
  Megaphone,
  Newspaper,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  PenLine,
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
  'format:standard': PenLine,
  'format:video': Video,
  'format:audio': Headphones,
  'format:ebook': BookMarked,
  pages: FileText,
  categories: FolderTree,
  authors: UserPen,
  quotes: Lightbulb,
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
const OPEN_KEY = 'im-nav-tucked-open'
const SCROLL_KEY = 'im-nav-scroll'
const RAIL_KEY = 'im-nav-rail'
// useLayoutEffect warns during SSR; the scroll restore only matters in the browser.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Private mode / blocked storage: the choice lasts for this page view only.
    }
  },
}

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
    const parsed: unknown = JSON.parse(storage.get(OPEN_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
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

/** The `where[format][equals]` value of a filtered content list, if the URL carries one. */
function formatOf(params: URLSearchParams | null): string | null {
  return params?.get('where[format][equals]') ?? null
}

/**
 * The sidebar (rendered by AdminNav with the groups from navModel.ts): brand, Dashboard, the
 * groups by job, and View website. On wide screens it folds to an icon rail (the button next to
 * the brand; remembered per browser); on phones Payload turns it into a drawer (admin-menu-sheet).
 */
export function AdminNavClient({ groups, user }: { groups: NavGroupData[]; user: NavUser }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const { config } = useConfig()
  const admin = config.routes.admin
  const logout = `${admin}${config.admin.routes.logout ?? '/logout'}`
  const [open, setOpen] = useState<string[]>([])
  const [rail, setRail] = useState(false)
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
    setRail(storage.get(RAIL_KEY) === '1')
  }, [])

  // The rail state lives on <html> so the page beside the sidebar can follow its width (nav.scss).
  useEffect(() => {
    const root = document.documentElement
    if (rail) root.dataset.imNav = 'rail'
    else delete root.dataset.imNav
    return () => {
      delete root.dataset.imNav
    }
  }, [rail])

  const toggleGroup = (key: string) => {
    const next = open.includes(key) ? open.filter((k) => k !== key) : [...open, key]
    setOpen(next)
    storage.set(OPEN_KEY, JSON.stringify(next))
  }
  const toggleRail = () => {
    const next = !rail
    setRail(next)
    storage.set(RAIL_KEY, next ? '1' : '0')
  }

  const hrefFor = (item: NavItemData) => `${admin}${item.href}`
  const pathOf = (href: string) => href.split('?')[0]!
  const within = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const format = formatOf(params)

  const itemActive = (item: NavItemData): boolean => {
    const path = `${admin}${pathOf(item.href)}`
    if (item.exact) return pathname === path
    if (item.key.startsWith('format:'))
      return pathname === path && format === new URL(item.href, 'http://x').searchParams.get('where[format][equals]')
    if (!within(path) && !(item.also ?? []).some((p) => within(`${admin}${p}`))) return false
    // "All content" is lit for every posts screen except a filtered kind (its child is lit instead).
    return !(item.children?.length && pathname === path && format)
  }

  const renderItem = (item: NavItemData, sub = false) => {
    const Icon = ICONS[item.key] ?? ICONS[item.slug] ?? File
    const active = itemActive(item)
    const showChildren = item.children?.length && within(`${admin}${pathOf(item.href)}`)
    return (
      <li key={item.key}>
        <Link
          href={hrefFor(item)}
          prefetch={false}
          className={sub ? 'im-nav__link im-nav__link--sub' : 'im-nav__link'}
          aria-current={active ? 'page' : undefined}
          title={rail ? item.label : undefined}
        >
          <span className="im-nav__icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="im-nav__text">{item.label}</span>
          {item.badge ? (
            <span className="im-nav__badge">
              {badgeText(item.badge)}
              <span className="im-nav__sr"> waiting</span>
            </span>
          ) : null}
        </Link>
        {showChildren ? (
          <ul className="im-nav__list im-nav__list--sub">
            {item.children!.map((child) => renderItem(child, true))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <nav
      ref={navRef}
      className={rail ? 'nav__wrap im-nav im-nav--rail' : 'nav__wrap im-nav'}
      aria-label="Admin"
    >
      <div className="im-nav__top">
        <Link href={admin} className="im-nav__brand" title={rail ? 'Islam Malayalam' : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/icon-192.png" alt="" width={36} height={36} />
          <span className="im-nav__brand-text">
            <span className="im-nav__brand-name">Islam Malayalam</span>
            <span className="im-nav__brand-sub">Editorial CMS</span>
          </span>
        </Link>
        <button
          type="button"
          className="im-nav__rail-toggle"
          onClick={toggleRail}
          aria-pressed={rail}
          aria-label={rail ? 'Expand the sidebar' : 'Collapse the sidebar'}
          title={rail ? 'Expand the sidebar' : 'Collapse the sidebar'}
        >
          {rail ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </div>

      <ul className="im-nav__list im-nav__list--home">
        <li>
          <Link
            href={admin}
            className="im-nav__link"
            aria-current={pathname === admin ? 'page' : undefined}
            title={rail ? 'Dashboard' : undefined}
          >
            <span className="im-nav__icon" aria-hidden="true">
              <LayoutDashboard />
            </span>
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
                onClick={() => toggleGroup(group.key)}
                title={rail ? group.label : undefined}
              >
                <span className="im-nav__icon" aria-hidden="true">
                  <ChevronRight data-open={expanded} />
                </span>
                <span className="im-nav__text">{group.label}</span>
              </button>
              {expanded ? (
                <ul id={id} className="im-nav__list">
                  {group.items.map((item) => renderItem(item))}
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
              {group.items.map((item) => renderItem(item))}
            </ul>
          </div>
        )
      })}

      <div className="im-nav__footer">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="im-nav__link"
          title={rail ? 'View website' : undefined}
        >
          <span className="im-nav__icon" aria-hidden="true">
            <ExternalLink />
          </span>
          <span className="im-nav__text">View website</span>
        </a>
        {/* Phones only (the header's account button is hidden there): who is signed in + sign out. */}
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
