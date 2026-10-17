'use client'

import { useEffect, useState } from 'react'
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
  Headphones,
  History,
  Images,
  Inbox,
  Megaphone,
  LayoutDashboard,
  LayoutPanelTop,
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
  website: LayoutPanelTop,
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const STORAGE_KEY = 'im-nav-tucked-open'

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

  const renderItem = (item: NavItemData) => {
    const href = hrefFor(item)
    const Icon = ICONS[item.slug] ?? File
    return (
      <li key={item.key}>
        <Link
          href={href}
          prefetch={false}
          className="im-nav__link"
          aria-current={isActive(href) ? 'page' : undefined}
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
    <nav className="nav__wrap im-nav" aria-label="Admin">
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
            <span className="im-nav__text">Today</span>
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
                <span className="im-nav__tag">Admins</span>
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
          <Link href={logout} className="im-nav__logout" aria-label="Log out" title="Log out">
            <LogOut aria-hidden="true" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
