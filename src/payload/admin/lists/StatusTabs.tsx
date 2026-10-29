'use client'

import { useEffect, useState } from 'react'
import { mergeListSearchAndWhere } from 'payload/shared'
import { useConfig, useListQuery } from '@payloadcms/ui'
import { buildWhere, whereParams, type Leaf, type ViewTab } from './listQuery'

/**
 * Status tabs at the top of the list toolbar: All · Published · Drafts · Needs review, each with
 * its count. A tab replaces only the status / review condition, so filter chips, search and sort
 * stay as they are. Counts follow the chips and the search box (so "Drafts 3" matches the table
 * under it), are read as the signed-in user (an author only counts what they may see) and with
 * drafts, exactly like the list, so a published post with unpublished edits counts as a draft.
 * They are plain toggle buttons: picking one filters the table, there are no tab panels.
 */
type StatusTabsProps = {
  tabs: ViewTab[]
  /** The other conditions (chips), applied to every count. */
  base: Leaf[]
  active: string | null
  disabled?: boolean
  onSelect: (key: string) => void
}

const countText = (n: number | undefined) =>
  n === undefined ? '' : n > 9999 ? `${Math.floor(n / 1000)}k` : String(n)

export function StatusTabs({ tabs, base, active, disabled, onSelect }: StatusTabsProps) {
  // `data` changes whenever the list reloads (delete, bulk edit, publish), so counts follow it.
  const { collectionSlug, data, query } = useListQuery()
  const { config, getEntityConfig } = useConfig()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const baseKey = JSON.stringify(base)
  const search = query?.search ?? ''

  useEffect(() => {
    if (!collectionSlug) return
    const collectionConfig = getEntityConfig({ collectionSlug })
    if (!collectionConfig) return
    const controller = new AbortController()
    const others = JSON.parse(baseKey) as Leaf[]
    // A chip change and the reload it causes arrive together: count once, after both.
    const timer = setTimeout(() => {
      void Promise.all(
        tabs.map(async (tab) => {
          const where = mergeListSearchAndWhere({
            collectionConfig,
            search,
            where: buildWhere([...others, ...(tab.leaf ? [tab.leaf] : [])]),
          })
          const params = whereParams(where)
          params.set('limit', '1')
          params.set('depth', '0')
          params.set('draft', 'true')
          const res = await fetch(`${config.routes.api}/${collectionSlug}?${params}`, {
            credentials: 'include',
            signal: controller.signal,
          })
          const body = (await res.json()) as { totalDocs?: unknown }
          return [tab.key, typeof body.totalDocs === 'number' ? body.totalDocs : NaN] as const
        }),
      )
        .then((pairs) => setCounts(Object.fromEntries(pairs.filter(([, n]) => Number.isFinite(n)))))
        .catch(() => {
          // Counts are a nicety: without them the tabs still filter.
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [baseKey, collectionSlug, config.routes.api, data, getEntityConfig, search, tabs])

  return (
    <div className="im-status-tabs" role="group" aria-label="Show">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={active === tab.key}
          disabled={disabled}
          title={disabled ? 'Clear the custom and/or filter to use these' : undefined}
          className="im-status-tabs__tab"
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
          {counts[tab.key] !== undefined ? (
            <span className="im-status-tabs__count">{countText(counts[tab.key])}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
