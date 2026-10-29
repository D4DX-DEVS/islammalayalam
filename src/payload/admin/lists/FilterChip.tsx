'use client'

import { useRef, useSyncExternalStore } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { FilterEditor } from './FilterEditors'
import type { FilterDef } from './listFields'
import { describeFilter } from './listDescribe'
import { pickedValues, type Leaf } from './listQuery'
import { Popover } from './Popover'
import { useRelationTitles } from './useRelationOptions'

type FilterChipProps = {
  def: FilterDef
  /** This field's conditions (with values). */
  leaves: Leaf[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** An editor's change: replaces the conditions that editor writes. */
  onChange: (next: Leaf[]) => void
  /** × and Clear: removes every condition on this field. */
  onClear: () => void
}

const noSubscribe = () => () => {}

/**
 * False while the server-rendered HTML hydrates. Date text depends on the time zone, and the
 * server (UTC) and the editor's browser (IST) would name a different day.
 */
const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )

/**
 * One filter in the toolbar: "Categories" with a chevron when unused, "Categories: Q&A, Fiqh +1"
 * with a remove button when set. The chip opens its editor; the remove button clears it at once.
 */
export function FilterChip({ def, leaves, open, onOpenChange, onChange, onClear }: FilterChipProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const hydrated = useHydrated()
  const names = useRelationTitles(def.relationTo, def.kind === 'relation' ? pickedValues(leaves) : [])
  const active = leaves.length > 0
  const text = def.kind === 'date' && !hydrated ? '' : describeFilter(def, leaves, new Date(), names)

  const close = (restoreFocus: boolean) => {
    onOpenChange(false)
    if (restoreFocus) trigger.current?.focus()
  }

  return (
    <div ref={anchor} className={`im-chip${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}>
      <button
        ref={trigger}
        type="button"
        className="im-chip__main"
        aria-haspopup="dialog"
        aria-expanded={open}
        // The label and value are separate flex items; spell the name out so it reads "Format: Video".
        aria-label={active ? `${def.label}: ${text}` : undefined}
        title={active ? `${def.label}: ${text}` : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span className="im-chip__label">
          {def.label}
          {active ? ':' : ''}
        </span>
        {active ? (
          <span className="im-chip__value">{text}</span>
        ) : (
          <ChevronDown aria-hidden="true" className="im-chip__icon" />
        )}
      </button>
      {active ? (
        <button
          type="button"
          className="im-chip__clear"
          aria-label={`Remove ${def.label} filter`}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
      {open ? (
        <Popover label={`Filter by ${def.label}`} anchor={anchor} onClose={close}>
          <div className="im-pop__head">
            {def.group ? <span className="im-pop__eyebrow">{def.group}</span> : null}
            <p className="im-pop__title">{def.label}</p>
          </div>
          <div className="im-pop__body">
            <FilterEditor def={def} leaves={leaves} onChange={onChange} />
          </div>
          <div className="im-pop__foot">
            <button type="button" className="im-filter-link" disabled={!active} onClick={onClear}>
              Clear
            </button>
            <button type="button" className="im-pop__done" onClick={() => close(true)}>
              Done
            </button>
          </div>
        </Popover>
      ) : null}
    </div>
  )
}
