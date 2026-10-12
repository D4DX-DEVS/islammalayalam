'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConfig } from '@payloadcms/ui'
import {
  ArrowRightLeft,
  ChevronDown,
  CircleUser,
  ExternalLink,
  File,
  FileText,
  FolderTree,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Newspaper,
  PanelBottom,
  PanelTop,
  ScrollText,
  Settings,
  TriangleAlert,
  UserPen,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItemData = { slug: string; kind: 'collection' | 'global'; label: string }
export type NavGroupData = { label: string; items: NavItemData[] }
type NavUser = { name: string; email: string; role: string }

const ICONS: Record<string, LucideIcon> = {
  posts: Newspaper,
  pages: FileText,
  categories: FolderTree,
  authors: UserPen,
  media: Images,
  redirects: ArrowRightLeft,
  'contact-messages': Inbox,
  users: Users,
  'audit-logs': ScrollText,
  'migration-runs': History,
  'migration-issues': TriangleAlert,
  'site-settings': Settings,
  header: PanelTop,
  homepage: LayoutTemplate,
  footer: PanelBottom,
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const STORAGE_KEY = 'im-nav-collapsed'
/** Rarely used groups start collapsed until the user opens them. */
const DEFAULT_COLLAPSED = ['Migration']

function readCollapsed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COLLAPSED
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : DEFAULT_COLLAPSED
  } catch {
    return DEFAULT_COLLAPSED
  }
}

function writeCollapsed(labels: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels))
  } catch {
    // Private mode / blocked storage: collapsing still works for this page view.
  }
}

const initials = (user: NavUser): string =>
  (user.name || user.email || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export function AdminNavClient({ groups, user }: { groups: NavGroupData[]; user: NavUser }) {
  const pathname = usePathname()
  const { config } = useConfig()
  const admin = config.routes.admin
  const logout = `${admin}${config.admin.routes.logout ?? '/logout'}`
  const [collapsed, setCollapsed] = useState<string[]>([])

  useEffect(() => {
    // Restored after mount so server and client render the same markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed())
  }, [])

  const toggle = (label: string) => {
    const next = collapsed.includes(label)
      ? collapsed.filter((l) => l !== label)
      : [...collapsed, label]
    setCollapsed(next)
    writeCollapsed(next)
  }

  const hrefFor = (item: NavItemData) =>
    `${admin}/${item.kind === 'collection' ? 'collections' : 'globals'}/${item.slug}`
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

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
            <span>Dashboard</span>
          </Link>
        </li>
      </ul>

      {groups.map((group) => {
        const open = !collapsed.includes(group.label)
        const id = `im-nav-group-${group.label.toLowerCase().replace(/\W+/g, '-')}`
        return (
          <div key={group.label} className="im-nav__group">
            <button
              type="button"
              className="im-nav__group-toggle"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => toggle(group.label)}
            >
              <span>{group.label}</span>
              <ChevronDown aria-hidden="true" data-open={open} />
            </button>
            {open ? (
              <ul id={id} className="im-nav__list">
                {group.items.map((item) => {
                  const href = hrefFor(item)
                  const Icon = ICONS[item.slug] ?? File
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        prefetch={false}
                        className="im-nav__link"
                        aria-current={isActive(href) ? 'page' : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}

      <div className="im-nav__footer">
        <a href="/" target="_blank" rel="noopener noreferrer" className="im-nav__link">
          <ExternalLink aria-hidden="true" />
          <span>View website</span>
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
            <CircleUser aria-hidden="true" className="im-nav__user-icon" />
          </Link>
          <Link href={logout} className="im-nav__logout" aria-label="Log out" title="Log out">
            <LogOut aria-hidden="true" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
