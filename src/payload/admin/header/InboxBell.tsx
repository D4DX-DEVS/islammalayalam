'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Inbox, Bell } from 'lucide-react'
import { useAuth, useConfig } from '@payloadcms/ui'

/**
 * The inbox: a bell in the admin header (admin.components.actions) and, on phones, the Inbox tab of
 * the bottom bar (AdminDock, `variant="dock"`, whose menu opens upwards). Shows how many contact
 * messages and postal library requests nobody has opened yet (status "new"), read as the signed-in
 * user, with a small menu that opens either list filtered to the new ones. No count is shown when
 * nothing is waiting. In the installed admin app the same total badges the app icon.
 */
const SOURCES = [
  { slug: 'contact-messages', label: 'New messages', icon: Inbox },
  { slug: 'postal-requests', label: 'New postal library requests', icon: BookOpen },
] as const

type Slug = (typeof SOURCES)[number]['slug']
type Counts = Partial<Record<Slug, number>>

// The header bell and the bottom bar mount together: one request per list serves both.
const inflight = new Map<string, Promise<Counts>>()

function loadCounts(api: string, readable: string): Promise<Counts> {
  const key = `${api}|${readable}`
  let request = inflight.get(key)
  if (!request) {
    request = Promise.all(
      readable.split(',').map(async (slug) => {
        const res = await fetch(`${api}/${slug}?limit=1&depth=0&where[status][equals]=new`, {
          credentials: 'include',
        })
        const body = (await res.json()) as { totalDocs?: unknown }
        return [slug, typeof body.totalDocs === 'number' ? body.totalDocs : 0] as const
      }),
    )
      .then((pairs): Counts => Object.fromEntries(pairs))
      .finally(() => inflight.delete(key))
    inflight.set(key, request)
  }
  return request
}

/** Installed app only: the waiting total on its home-screen / taskbar icon. */
function badgeAppIcon(total: number): void {
  if (!('setAppBadge' in navigator) || !matchMedia('(display-mode: standalone)').matches) return
  const done = total ? navigator.setAppBadge(total) : navigator.clearAppBadge()
  done.catch(() => {
    // Not allowed here (or not installed): the in-page count is enough.
  })
}

export function InboxBell({
  variant = 'header',
  active = false,
}: {
  variant?: 'header' | 'dock'
  /** Dock only: an inbox list is the current screen. */
  active?: boolean
}) {
  const { config } = useConfig()
  const { permissions } = useAuth()
  const [counts, setCounts] = useState<Counts>({})
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const api = `${config.serverURL ?? ''}${config.routes.api}`
  const admin = config.routes.admin
  const sources = SOURCES.filter((s) => permissions?.collections?.[s.slug]?.read)
  const readable = sources.map((s) => s.slug).join(',')
  const dock = variant === 'dock'

  useEffect(() => {
    if (!readable) return
    let live = true
    loadCounts(api, readable)
      .then((next) => {
        if (!live) return
        setCounts(next)
        if (!dock) badgeAppIcon(Object.values(next).reduce((sum, n) => sum + (n ?? 0), 0))
      })
      .catch(() => {
        // No count is better than a broken header.
      })
    return () => {
      live = false
    }
  }, [api, readable, dock])

  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (!sources.length) return null
  const total = sources.reduce((sum, s) => sum + (counts[s.slug] ?? 0), 0)
  const badge = total ? <span className="im-bell__badge">{total > 99 ? '99+' : total}</span> : null

  return (
    <div className={dock ? 'im-bell im-bell--dock' : 'im-bell'} ref={root}>
      <button
        ref={button}
        type="button"
        className={dock ? 'im-dock__item' : 'im-bell__trigger'}
        data-active={dock && active ? '' : undefined}
        aria-label={total ? `Inbox: ${total} waiting` : 'Inbox: nothing waiting'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {dock ? (
          <>
            <span className="im-dock__icon">
              <Inbox aria-hidden="true" />
              {badge}
            </span>
            <span aria-hidden="true">Inbox</span>
          </>
        ) : (
          <>
            <Bell aria-hidden="true" />
            {badge}
          </>
        )}
      </button>
      {open ? (
        <div className="im-bell__menu" role="menu" aria-label="Inbox">
          {sources.map(({ slug, label, icon: Icon }) => (
            <Link
              key={slug}
              role="menuitem"
              href={`${admin}/collections/${slug}?where[status][equals]=new`}
              className="im-bell__item"
              onClick={() => setOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <span className="im-bell__count">{counts[slug] ?? 0}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
