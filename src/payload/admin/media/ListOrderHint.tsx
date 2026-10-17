'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowDownUp, Plus } from 'lucide-react'
import { useConfig, useListQuery } from '@payloadcms/ui'

/**
 * Above the Audios / Videos / Insights lists (admin.components.beforeListTable): an "Add new"
 * button and how to reorder. Dragging a row only works while the list is sorted by position, and
 * Payload remembers the last sort a person used, so a list could open sorted by date with the drag
 * handles greyed out. This opens the list in position order (once per visit, so a deliberate sort
 * afterwards is respected) and, while it is sorted any other way, offers a button to go back.
 */
const NOUN: Record<string, string> = { audios: 'audio', videos: 'video', quotes: 'poster' }

export function ListOrderHint() {
  const { collectionSlug, handleSortChange, orderableFieldName, query } = useListQuery()
  const { config } = useConfig()
  const order = orderableFieldName ?? '_order'
  const sort = query?.sort
  const byPosition = sort === order || sort === `-${order}`

  // Read through a ref: the timer below fires after Payload has settled the list's own sort.
  const latest = useRef({ byPosition, handleSortChange })
  useEffect(() => {
    latest.current = { byPosition, handleSortChange }
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!latest.current.byPosition) void latest.current.handleSortChange?.(`-${order}`)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [order])

  return (
    <div className="im-order-hint" role="note">
      <ArrowDownUp aria-hidden="true" />
      <p>
        Drag a row by its handle, or use the up and down arrows, to set the order. The top row is
        shown first on the site.
      </p>
      {byPosition ? null : (
        <button type="button" onClick={() => void handleSortChange?.(`-${order}`)}>
          Sort by position
        </button>
      )}
      {collectionSlug ? (
        <Link
          className="im-order-hint__add"
          href={`${config.routes.admin}/collections/${collectionSlug}/create`}
        >
          <Plus aria-hidden="true" />
          Add new {NOUN[collectionSlug] ?? 'entry'}
        </Link>
      ) : null}
    </div>
  )
}
