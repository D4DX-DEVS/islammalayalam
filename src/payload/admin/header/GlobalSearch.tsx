'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useConfig } from '@payloadcms/ui'
import { FileText, FolderTree, Newspaper, Search, type LucideIcon } from 'lucide-react'

/**
 * Search in the admin header (admin.components.actions): a search box that opens a finder over
 * posts (title or post number), pages and categories. Ctrl+K / ⌘K or "/" opens it from anywhere;
 * ↑ ↓ choose, Enter opens, Esc closes. Results come from Payload's REST API as the signed-in user,
 * only for the lists this role may read, with drafts included like the admin lists.
 */
type Hit = { key: string; label: string; meta: string; href: string; icon: LucideIcon }

type Source = {
  slug: 'posts' | 'pages' | 'categories'
  noun: string
  icon: LucideIcon
  field: 'title' | 'name'
  limit: number
}

const SOURCES: Source[] = [
  { slug: 'posts', noun: 'Post', icon: Newspaper, field: 'title', limit: 6 },
  { slug: 'pages', noun: 'Page', icon: FileText, field: 'title', limit: 4 },
  { slug: 'categories', noun: 'Category', icon: FolderTree, field: 'name', limit: 4 },
]

type Doc = { id: string | number; title?: string; name?: string; postNumber?: number | null }

function queryFor(source: Source, text: string): string {
  const params = new URLSearchParams({ limit: String(source.limit), depth: '0', draft: 'true' })
  params.set(`select[${source.field}]`, 'true')
  params.set(`where[or][0][${source.field}][like]`, text)
  if (source.slug === 'posts') {
    params.set('select[postNumber]', 'true')
    if (/^\d{1,7}$/.test(text)) params.set('where[or][1][postNumber][equals]', text)
  }
  return params.toString()
}

export function GlobalSearch() {
  const { config } = useConfig()
  const { permissions } = useAuth()
  const router = useRouter()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const admin = config.routes.admin
  const api = `${config.serverURL ?? ''}${config.routes.api}`
  const sources = useMemo(
    () => SOURCES.filter((s) => permissions?.collections?.[s.slug]?.read),
    [permissions],
  )

  const close = useCallback(() => {
    setOpen(false)
    setText('')
    setHits([])
    trigger.current?.focus()
  }, [])

  // Ctrl+K / ⌘K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  useEffect(() => {
    const q = text.trim()
    if (!open || q.length < 2 || !sources.length) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void Promise.all(
        sources.map(async (source) => {
          const res = await fetch(`${api}/${source.slug}?${queryFor(source, q)}`, {
            credentials: 'include',
            signal: controller.signal,
          })
          if (!res.ok) return []
          const body = (await res.json()) as { docs?: Doc[] }
          return (body.docs ?? []).map(
            (doc): Hit => ({
              key: `${source.slug}:${doc.id}`,
              label: (doc[source.field] ?? '').trim() || '(untitled)',
              meta:
                source.slug === 'posts' && doc.postNumber
                  ? `${source.noun} #${doc.postNumber}`
                  : source.noun,
              href: `${admin}/collections/${source.slug}/${doc.id}`,
              icon: source.icon,
            }),
          )
        }),
      )
        .then((groups) => {
          setHits(groups.flat())
          setActive(0)
          setBusy(false)
        })
        .catch(() => {
          // Aborted by the next keystroke, or offline: the list simply stays as it was.
        })
    }, 200)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text, open, sources, api, admin])

  const q = text.trim()
  // Results only stand for what is typed now: under two letters there are none.
  const shown = q.length >= 2 ? hits : []

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    close()
    router.push(hit.href)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(shown[active])
    }
  }

  if (!sources.length) return null
  const listId = `${uid}-results`

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="im-search__trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Search aria-hidden="true" />
        <span className="im-search__placeholder">Search posts, pages, categories…</span>
        <kbd className="im-search__kbd">Ctrl K</kbd>
      </button>

      {open ? (
        <div
          className="im-search__backdrop"
          onPointerDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="im-search__dialog" role="dialog" aria-modal="true" aria-label="Search">
            <div className="im-search__field">
              <Search aria-hidden="true" />
              <input
                ref={input}
                type="search"
                value={text}
                placeholder="Search by title or post number"
                aria-label="Search posts, pages and categories"
                role="combobox"
                aria-expanded={shown.length > 0}
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${uid}-${active}` : undefined}
                autoComplete="off"
                onChange={(e) => {
                  setText(e.target.value)
                  setBusy(e.target.value.trim().length >= 2)
                }}
                onKeyDown={onKeyDown}
              />
              <kbd className="im-search__kbd">Esc</kbd>
            </div>
            <ul id={listId} role="listbox" className="im-search__list" aria-label="Results">
              {shown.map((hit, i) => {
                const Icon = hit.icon
                return (
                  <li
                    key={hit.key}
                    id={`${uid}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="im-search__hit"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                  >
                    <span className="im-search__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="im-search__label">{hit.label}</span>
                    <span className="im-search__meta">{hit.meta}</span>
                  </li>
                )
              })}
            </ul>
            <p className="im-search__status" aria-live="polite">
              {q.length < 2
                ? 'Type at least two letters, or a post number.'
                : busy
                  ? 'Searching…'
                  : shown.length
                    ? `${shown.length} found. ↑ ↓ to choose, Enter to open.`
                    : 'Nothing found.'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
