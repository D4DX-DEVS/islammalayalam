'use client'

import { useId, useMemo, useState, type FormEvent } from 'react'
import { RotateCw, Search } from 'lucide-react'
import type { FilterDef } from './listFields'
import { pickedValues, type Leaf } from './listQuery'
import {
  DATE_PRESETS,
  booleanLeaves,
  dateLeaves,
  dayKey,
  fromDayKey,
  matchPreset,
  readBoolean,
  readDateRange,
  readNumberRange,
} from './listDescribe'
import { useRelationSearch, useRelationTitles } from './useRelationOptions'

/**
 * The inside of a filter chip's panel, one editor per kind of field. Choices apply as they are
 * ticked; typed values (text, numbers, a custom date range) apply on Enter or Apply.
 */
type EditorProps = { def: FilterDef; leaves: Leaf[]; onChange: (next: Leaf[]) => void }

export function FilterEditor(props: EditorProps) {
  switch (props.def.kind) {
    case 'options':
      return <OptionsEditor {...props} />
    case 'relation':
      return <RelationEditor {...props} />
    case 'boolean':
    case 'presence':
      return <BooleanEditor {...props} />
    case 'date':
      return <DateEditor {...props} />
    case 'number':
      return <NumberEditor {...props} />
    default:
      return <TextEditor {...props} />
  }
}

const inLeaves = (path: string, values: string[]): Leaf[] =>
  values.length ? [{ path, op: 'in', value: values }] : []

/**
 * Inside a relationship drawer the toolbar sits within the document's own <form> in the React
 * tree, so a submit must stop here or it would save that document (Payload's Form does the same).
 */
const submitOnly = (e: FormEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="im-filter-search">
      <Search aria-hidden="true" className="im-filter-search__icon" />
      <span className="im-visually-hidden">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        data-autofocus
      />
    </label>
  )
}

type CheckItem = { value: string; label: string }

function CheckList({ items, picked, onToggle, label }: {
  items: CheckItem[]
  picked: string[]
  onToggle: (value: string) => void
  label: string
}) {
  return (
    <ul className="im-filter-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.value}>
          <label className="im-filter-check">
            <input
              type="checkbox"
              checked={picked.includes(item.value)}
              onChange={() => onToggle(item.value)}
            />
            <span>{item.label}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

function OptionsEditor({ def, leaves, onChange }: EditorProps) {
  const [query, setQuery] = useState('')
  const picked = pickedValues(leaves)
  const options = def.options ?? []
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  return (
    <>
      {options.length > 8 ? <SearchBox value={query} onChange={setQuery} label={`Find ${def.label.toLowerCase()}`} /> : null}
      <CheckList
        label={def.label}
        items={shown}
        picked={picked}
        onToggle={(v) => onChange(inLeaves(def.path, toggle(picked, v)))}
      />
      {shown.length === 0 ? <p className="im-filter-empty">No matches</p> : null}
    </>
  )
}

function RelationEditor({ def, leaves, onChange }: EditorProps) {
  const [query, setQuery] = useState('')
  const picked = pickedValues(leaves)
  // Items picked when the panel opened stay on top; ticking more never moves rows under the pointer.
  const [pinned] = useState(picked)
  const names = useRelationTitles(def.relationTo, pinned)
  const { items, status, retry, more } = useRelationSearch(def.relationTo, query)
  const list = useMemo(() => {
    const top = query ? [] : pinned.map((id) => ({ value: id, label: names[id] ?? 'Loading…' }))
    const rest = items
      .filter((i) => query || !pinned.includes(i.id))
      .map((i) => ({ value: i.id, label: i.title }))
    return [...top, ...rest]
  }, [items, names, pinned, query])

  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={`Find ${def.label.toLowerCase()}`} />
      {list.length > 0 ? (
        <CheckList
          label={def.label}
          items={list}
          picked={picked}
          onToggle={(v) => onChange(inLeaves(def.path, toggle(picked, v)))}
        />
      ) : null}
      {status === 'loading' && items.length === 0 ? (
        <ul className="im-filter-list" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} className="im-filter-skeleton" />
          ))}
        </ul>
      ) : null}
      {status === 'error' ? (
        <div className="im-filter-empty" role="alert">
          Could not load the list.
          <button type="button" className="im-filter-link" onClick={retry}>
            <RotateCw aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}
      {status === 'ready' && list.length === 0 ? <p className="im-filter-empty">No matches</p> : null}
      {status === 'ready' && more ? (
        <p className="im-filter-empty">Showing the first {items.length}. Type to find others.</p>
      ) : null}
    </>
  )
}

function BooleanEditor({ def, leaves, onChange }: EditorProps) {
  const name = useId()
  const value = readBoolean(leaves)
  const presence = def.kind === 'presence'
  const choices: Array<{ label: string; value: boolean | undefined }> = [
    { label: 'Any', value: undefined },
    { label: presence ? 'Added' : 'Yes', value: true },
    { label: presence ? 'Missing' : 'No', value: false },
  ]
  return (
    <fieldset className="im-filter-segment">
      <legend className="im-visually-hidden">{def.label}</legend>
      {choices.map((c) => (
        <label key={c.label} className="im-filter-segment__item">
          <input
            type="radio"
            name={name}
            checked={value === c.value}
            onChange={() => onChange(booleanLeaves(def.path, c.value, presence ? 'presence' : 'boolean'))}
          />
          <span>{c.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

function DateEditor({ def, leaves, onChange }: EditorProps) {
  const now = new Date()
  const range = readDateRange(leaves)
  const preset = matchPreset(range, now)
  const [from, setFrom] = useState(range.from ? dayKey(range.from) : '')
  const [to, setTo] = useState(range.to ? dayKey(range.to) : '')
  const name = useId()
  const custom = !preset && Boolean(range.from || range.to)

  const apply = (e: FormEvent) => {
    submitOnly(e)
    onChange(dateLeaves(def.path, { from: fromDayKey(from), to: fromDayKey(to) }))
  }
  const pickPreset = (range: { from?: Date; to?: Date }) => {
    setFrom(range.from ? dayKey(range.from) : '')
    setTo(range.to ? dayKey(range.to) : '')
    onChange(dateLeaves(def.path, range))
  }

  return (
    <>
      <fieldset className="im-filter-presets">
        <legend className="im-visually-hidden">{def.label}</legend>
        {DATE_PRESETS.map((p) => (
          <label key={p.key} className="im-filter-check">
            <input
              type="radio"
              name={name}
              checked={preset?.key === p.key}
              onChange={() => pickPreset(p.range(new Date()))}
            />
            <span>{p.label}</span>
          </label>
        ))}
      </fieldset>
      <form className={`im-filter-range${custom ? ' is-current' : ''}`} onSubmit={apply}>
        <p className="im-filter-range__title">Custom range</p>
        <div className="im-filter-range__inputs">
          <label>
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="im-filter-apply" disabled={!from && !to}>
          Apply range
        </button>
      </form>
    </>
  )
}

function NumberEditor({ def, leaves, onChange }: EditorProps) {
  const current = readNumberRange(leaves)
  const [min, setMin] = useState(current.min === undefined ? '' : String(current.min))
  const [max, setMax] = useState(current.max === undefined ? '' : String(current.max))
  const apply = (e: FormEvent) => {
    submitOnly(e)
    const next: Leaf[] = []
    if (min.trim() !== '' && Number.isFinite(Number(min)))
      next.push({ path: def.path, op: 'greater_than_equal', value: Number(min) })
    if (max.trim() !== '' && Number.isFinite(Number(max)))
      next.push({ path: def.path, op: 'less_than_equal', value: Number(max) })
    onChange(next)
  }
  return (
    <form className="im-filter-range" onSubmit={apply}>
      <div className="im-filter-range__inputs">
        <label>
          <span>At least</span>
          <input type="number" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} data-autofocus />
        </label>
        <label>
          <span>At most</span>
          <input type="number" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="im-filter-apply">
        Apply
      </button>
    </form>
  )
}

function TextEditor({ def, leaves, onChange }: EditorProps) {
  const current = leaves.find((l) => l.op === 'like')
  const [text, setText] = useState(current ? String(current.value) : '')
  const apply = (e: FormEvent) => {
    submitOnly(e)
    const value = text.trim()
    onChange(value ? [{ path: def.path, op: 'like', value }] : [])
  }
  return (
    <form className="im-filter-range" onSubmit={apply}>
      <label className="im-filter-range__single">
        <span>Contains</span>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} data-autofocus />
      </label>
      <button type="submit" className="im-filter-apply">
        Apply
      </button>
    </form>
  )
}
