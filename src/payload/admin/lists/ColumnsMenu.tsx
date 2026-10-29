'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Columns3, GripVertical, RotateCcw, Search } from 'lucide-react'
import { useTableColumns } from '@payloadcms/ui'
import { columnItems, isDefaultLayout, type ColumnItem } from './listFields'
import { Popover } from './Popover'

/**
 * The Columns button: a panel with the shown columns in table order (drag the handle, or focus it
 * and use the arrow keys, to reorder) and the hidden ones grouped by section. Changes go through
 * Payload's column state, so they are saved to the editor's list preferences as before.
 */
export function ColumnsMenu({ defaults }: { defaults: string[] }) {
  const { columns, moveColumn, resetColumnsState, toggleColumn } = useTableColumns()
  const anchor = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  /** The row whose handle gets focus back once the new order has rendered. */
  const refocus = useRef<string | null>(null)

  const items = useMemo(() => columnItems(columns ?? [], defaults), [columns, defaults])
  const shown = items.filter((i) => i.active)
  const order = shown.map((s) => s.accessor).join('|')

  useEffect(() => {
    if (!refocus.current) return
    handles.current.get(refocus.current)?.focus()
    refocus.current = null
  }, [order])
  const q = query.trim().toLowerCase()
  const matches = (i: ColumnItem) => !q || `${i.group ?? ''} ${i.label}`.toLowerCase().includes(q)
  const byGroup = new Map<string, ColumnItem[]>()
  for (const i of items)
    if (!i.active && matches(i)) byGroup.set(i.group ?? '', [...(byGroup.get(i.group ?? '') ?? []), i])
  const hiddenGroups = [...byGroup.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0))

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) trigger.current?.focus()
  }

  const move = (from: ColumnItem, to: ColumnItem) => {
    if (from.accessor === to.accessor) return
    // Moving the row in the DOM drops its focus; the effect above puts it back.
    refocus.current = from.accessor
    void moveColumn({ fromIndex: from.index, toIndex: to.index })
    const position = shown.findIndex((s) => s.accessor === to.accessor) + 1
    setAnnouncement(`${from.label} moved to position ${position} of ${shown.length}`)
  }
  const stopDrag = () => {
    setDragging(null)
    setOver(null)
  }

  const onHandleKey = (e: KeyboardEvent, item: ColumnItem) => {
    const at = shown.findIndex((s) => s.accessor === item.accessor)
    const target = e.key === 'ArrowUp' ? shown[at - 1] : e.key === 'ArrowDown' ? shown[at + 1] : undefined
    if (!target) return
    e.preventDefault()
    move(item, target)
  }

  // Pointer dragging (mouse, pen and touch alike): the row under the finger is the drop target.
  const rowAt = (e: PointerEvent) =>
    (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)
      ?.closest<HTMLElement>('[data-column]')
      ?.dataset.column ?? null
  const endDrag = () => {
    const from = shown.find((s) => s.accessor === dragging)
    const to = shown.find((s) => s.accessor === over)
    if (from && to) move(from, to)
    stopDrag()
  }

  const label = (i: ColumnItem) => (i.group && q ? `${i.group} · ${i.label}` : i.label)

  return (
    <div ref={anchor} className={`im-chip im-chip--columns${open ? ' is-open' : ''}`}>
      <button
        ref={trigger}
        type="button"
        className="im-chip__main"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Columns3 aria-hidden="true" className="im-chip__icon" />
        <span className="im-chip__label">Columns</span>
        <span className="im-chip__count">
          {shown.length}
          <span className="im-visually-hidden"> shown</span>
        </span>
      </button>
      {open ? (
        <Popover label="Choose columns" anchor={anchor} onClose={close} align="end" className="im-pop--columns">
          <div className="im-pop__head">
            <p className="im-pop__title">Columns</p>
            <button
              type="button"
              className="im-filter-link"
              disabled={isDefaultLayout(items, defaults)}
              onClick={() => void resetColumnsState()}
            >
              <RotateCcw aria-hidden="true" /> Reset
            </button>
          </div>
          <label className="im-filter-search">
            <Search aria-hidden="true" className="im-filter-search__icon" />
            <span className="im-visually-hidden">Find a column</span>
            <input
              type="search"
              value={query}
              placeholder="Find a column"
              onChange={(e) => setQuery(e.target.value)}
              data-autofocus
            />
          </label>
          <div className="im-pop__body im-pop__body--flush">
            <div className="im-menu-group">
              <p className="im-menu-group__title">Shown in the table</p>
              <ul className="im-col-list" aria-label="Shown columns">
                {shown.filter(matches).map((item) => (
                  <li
                    key={item.accessor}
                    data-column={item.accessor}
                    className={`im-col-row${dragging === item.accessor ? ' is-dragging' : ''}${
                      over === item.accessor && dragging && dragging !== item.accessor ? ' is-over' : ''
                    }`}
                  >
                    {!q ? (
                      <button
                        ref={(el) => {
                          if (el) handles.current.set(item.accessor, el)
                          else handles.current.delete(item.accessor)
                        }}
                        type="button"
                        className="im-col-row__handle"
                        aria-label={`Move ${item.label}. Use the up and down arrow keys.`}
                        onKeyDown={(e) => onHandleKey(e, item)}
                        onPointerDown={(e) => {
                          if (e.button !== 0 || !e.isPrimary) return
                          e.currentTarget.setPointerCapture(e.pointerId)
                          setDragging(item.accessor)
                          setOver(item.accessor)
                        }}
                        onPointerMove={(e) => {
                          if (dragging) setOver(rowAt(e) ?? over)
                        }}
                        onPointerUp={endDrag}
                        onPointerCancel={stopDrag}
                        onLostPointerCapture={stopDrag}
                      >
                        <GripVertical aria-hidden="true" />
                      </button>
                    ) : null}
                    <label className="im-filter-check">
                      <input
                        type="checkbox"
                        checked
                        disabled={shown.length === 1}
                        onChange={() => void toggleColumn(item.accessor)}
                      />
                      <span>{label(item)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            {hiddenGroups.map(([group, list]) => (
              <div key={group || 'fields'} className="im-menu-group">
                <p className="im-menu-group__title">{group || 'More columns'}</p>
                <ul className="im-col-list">
                  {list.map((item) => (
                    <li key={item.accessor} className="im-col-row">
                      <label className="im-filter-check">
                        <input type="checkbox" checked={false} onChange={() => void toggleColumn(item.accessor)} />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {q && !items.some(matches) ? <p className="im-filter-empty">No column matches “{query}”</p> : null}
          </div>
          <p className="im-visually-hidden" aria-live="polite">
            {announcement}
          </p>
        </Popover>
      ) : null}
    </div>
  )
}
