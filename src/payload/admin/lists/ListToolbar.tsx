'use client'

import { useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useAuth, useConfig, useListQuery } from '@payloadcms/ui'
import { AddFilterMenu } from './AddFilterMenu'
import { ColumnsMenu } from './ColumnsMenu'
import { FilterChip } from './FilterChip'
import { EDITOR_OPS } from './listDescribe'
import { filterDefs, quickFilters, type FieldPermissions, type FilterDef } from './listFields'
import {
  activeTab,
  buildWhere,
  isSet,
  leavesFor,
  parseWhere,
  replaceOps,
  replacePath,
  selectTab,
  tabPaths,
  viewTabs,
  type Leaf,
} from './listQuery'
import { StatusTabs } from './StatusTabs'

/**
 * The toolbar above every collection list (admin.components.beforeListTable, added to each
 * collection in payload.config.ts). It replaces Payload's pill wall of columns and its filter
 * panel with: status tabs, one chip per useful filter (the collection's `admin.custom.listFilters`,
 * or picked from its fields), "Add filter" for every other field, a Columns menu and the result
 * count. Everything is stored in Payload's own list query (URL + preferences), so sharing a link,
 * the back button, search, sort and paging behave as before. Payload's condition builder stays
 * available behind "Advanced" for and/or filters (admin-lists.scss hides its own toggles).
 */
export function ListToolbar() {
  const { collectionSlug } = useListQuery()
  // A relationship drawer that switches collection starts the toolbar afresh.
  return <Toolbar key={collectionSlug} />
}

function Toolbar() {
  const { collectionSlug, data, handleWhereChange, query } = useListQuery()
  const { getEntityConfig } = useConfig()
  const { permissions } = useAuth()
  const collection = collectionSlug ? getEntityConfig({ collectionSlug }) : undefined
  const root = useRef<HTMLDivElement>(null)
  const advancedPanel = useAdvancedPanel(root)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [extra, setExtra] = useState<string[]>([])

  const fields = collection?.fields
  const fieldPerms = (collectionSlug ? permissions?.collections?.[collectionSlug]?.fields : undefined) as
    | FieldPermissions
    | undefined
  const defs = useMemo(() => filterDefs(fields ?? [], fieldPerms), [fields, fieldPerms])
  const byPath = useMemo(() => new Map(defs.map((d) => [d.path, d])), [defs])
  const tabs = useMemo(() => viewTabs(new Set(defs.map((d) => d.path))), [defs])
  const owned = useMemo(() => tabPaths(tabs), [tabs])
  const configured = (collection?.admin as { custom?: { listFilters?: unknown } } | undefined)?.custom
    ?.listFilters
  const quick = useMemo(() => quickFilters(defs, configured, owned), [defs, configured, owned])
  const { leaves, advanced } = useMemo(() => parseWhere(query?.where), [query?.where])

  if (!collection) return null

  const apply = (next: Leaf[]) => void handleWhereChange?.(buildWhere(next))
  const others = leaves.filter((l) => isSet(l) && !owned.includes(l.path))
  const unknown = others.filter((l) => !byPath.has(l.path))
  const chipPaths = [
    ...new Set([...quick.map((d) => d.path), ...others.map((l) => l.path), ...extra]),
  ]
  const chips = chipPaths.flatMap((p) => byPath.get(p) ?? [])
  const addable = defs.filter((d) => !owned.includes(d.path) && !chipPaths.includes(d.path))
  const filtered = advanced || others.length > 0
  const total = data?.totalDocs

  const onChipChange = (def: FilterDef) => (next: Leaf[]) =>
    apply(replaceOps(leaves, def.path, EDITOR_OPS[def.kind], next))
  const onChipClear = (def: FilterDef) => () => {
    apply(replacePath(leaves, def.path, []))
    if (openPath !== def.path) setExtra((x) => x.filter((p) => p !== def.path))
  }
  const onChipOpen = (def: FilterDef) => (open: boolean) => {
    setOpenPath(open ? def.path : null)
    // A field added from "Add filter" and left empty goes away again when its panel closes.
    if (!open && leavesFor(leaves, def.path).length === 0)
      setExtra((x) => x.filter((p) => p !== def.path))
  }

  return (
    <div ref={root} className="im-list-toolbar">
      {tabs.length ? (
        <StatusTabs
          tabs={tabs}
          base={others}
          active={advanced ? null : activeTab(tabs, leaves)}
          // An and/or filter cannot take a tab without losing its groups: clear it first.
          disabled={advanced}
          onSelect={(key) => apply(selectTab(tabs, leaves, key))}
        />
      ) : null}
      <div className="im-list-toolbar__bar" role="group" aria-label="Filters and columns">
        <div className="im-list-toolbar__filters">
          {advanced ? (
            <div className="im-chip is-active">
              <button type="button" className="im-chip__main" onClick={advancedPanel.toggle}>
                <SlidersHorizontal aria-hidden="true" className="im-chip__icon" />
                <span className="im-chip__label">Custom and/or filter</span>
              </button>
              <button type="button" className="im-chip__clear" aria-label="Remove custom filter" onClick={() => apply([])}>
                <X aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {chips.map((def) => (
                <FilterChip
                  key={def.path}
                  def={def}
                  leaves={leavesFor(leaves, def.path)}
                  open={openPath === def.path}
                  onOpenChange={onChipOpen(def)}
                  onChange={onChipChange(def)}
                  onClear={onChipClear(def)}
                />
              ))}
              {unknown.length ? (
                <button type="button" className="im-chip im-chip--note" onClick={advancedPanel.toggle}>
                  {unknown.length === 1 ? '1 more condition' : `${unknown.length} more conditions`}
                </button>
              ) : null}
              <AddFilterMenu
                defs={addable}
                onPick={(path) => {
                  setExtra((x) => [...x, path])
                  setOpenPath(path)
                }}
              />
            </>
          )}
          {advancedPanel.available ? (
            <button
              type="button"
              className="im-chip im-chip--ghost"
              aria-pressed={advancedPanel.open}
              onClick={advancedPanel.toggle}
            >
              <SlidersHorizontal aria-hidden="true" className="im-chip__icon" />
              <span className="im-chip__label">Advanced</span>
            </button>
          ) : null}
          {filtered ? (
            <button
              type="button"
              className="im-filter-link im-list-toolbar__clear"
              onClick={() => {
                setExtra([])
                apply(advanced ? [] : leaves.filter((l) => owned.includes(l.path)))
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="im-list-toolbar__end">
          {typeof total === 'number' ? (
            <span className="im-list-toolbar__count" aria-live="polite">
              {total === 1 ? '1 result' : `${total.toLocaleString('en-US')} results`}
            </span>
          ) : null}
          <ColumnsMenu defaults={collection.admin?.defaultColumns ?? []} />
        </div>
      </div>
    </div>
  )
}

/**
 * Payload's own filter panel (and/or groups, every operator) lives in its list controls above the
 * table. Its toggle is hidden by admin-lists.scss; this drives it and mirrors whether it is open.
 */
function useAdvancedPanel(root: RefObject<HTMLDivElement | null>) {
  const findToggle = () =>
    root.current?.closest('.collection-list')?.querySelector<HTMLElement>('.list-controls__toggle-where') ??
    null
  const subscribe = (notify: () => void) => {
    const toggle = findToggle()
    if (!toggle) return () => {}
    const observer = new MutationObserver(notify)
    observer.observe(toggle, { attributes: true, attributeFilter: ['aria-expanded'] })
    return () => observer.disconnect()
  }
  const state = useSyncExternalStore(
    subscribe,
    () => {
      const toggle = findToggle()
      if (!toggle) return 'missing'
      return toggle.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'
    },
    () => 'missing',
  )
  return {
    open: state === 'open',
    available: state !== 'missing',
    toggle: () => findToggle()?.click(),
  }
}
