'use client'

import { useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Hash,
  Image,
  Link2,
  ListChecks,
  Plus,
  Search,
  ToggleLeft,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { FilterDef, FilterKind } from './listFields'
import { Popover } from './Popover'

const KIND_ICON: Record<FilterKind, LucideIcon> = {
  options: ListChecks,
  relation: Link2,
  boolean: ToggleLeft,
  presence: Image,
  date: CalendarDays,
  number: Hash,
  text: Type,
}

type AddFilterMenuProps = {
  /** Fields without a chip yet. */
  defs: FilterDef[]
  onPick: (path: string) => void
}

/** "Add filter": every other filterable field, grouped and searchable. */
export function AddFilterMenu({ defs, onPick }: AddFilterMenuProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hits = q
      ? defs.filter((d) => `${d.group ?? ''} ${d.label}`.toLowerCase().includes(q))
      : defs
    const map = new Map<string, FilterDef[]>()
    for (const d of hits) map.set(d.group ?? '', [...(map.get(d.group ?? '') ?? []), d])
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0))
  }, [defs, query])

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) trigger.current?.focus()
  }

  if (defs.length === 0) return null

  return (
    <div ref={anchor} className={`im-chip im-chip--add${open ? ' is-open' : ''}`}>
      <button
        ref={trigger}
        type="button"
        className="im-chip__main"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Plus aria-hidden="true" className="im-chip__icon" />
        <span className="im-chip__label">Add filter</span>
      </button>
      {open ? (
        <Popover label="Add a filter" anchor={anchor} onClose={close} className="im-pop--menu">
          {defs.length > 6 ? (
            <label className="im-filter-search">
              <Search aria-hidden="true" className="im-filter-search__icon" />
              <span className="im-visually-hidden">Find a field</span>
              <input
                type="search"
                value={query}
                placeholder="Find a field"
                onChange={(e) => setQuery(e.target.value)}
                data-autofocus
              />
            </label>
          ) : null}
          <div className="im-pop__body im-pop__body--flush">
            {groups.map(([group, list]) => (
              <div key={group || 'fields'} className="im-menu-group">
                {group ? <p className="im-menu-group__title">{group}</p> : null}
                <ul className="im-menu-list">
                  {list.map((d) => {
                    const Icon = KIND_ICON[d.kind]
                    return (
                      <li key={d.path}>
                        <button
                          type="button"
                          className="im-menu-item"
                          onClick={() => {
                            close(false)
                            onPick(d.path)
                          }}
                        >
                          <Icon aria-hidden="true" />
                          <span>{d.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {groups.length === 0 ? <p className="im-filter-empty">No field matches “{query}”</p> : null}
          </div>
        </Popover>
      ) : null}
    </div>
  )
}
