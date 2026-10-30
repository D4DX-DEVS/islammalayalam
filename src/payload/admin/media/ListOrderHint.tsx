'use client'

import { useEffect, useRef } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { useListQuery } from '@payloadcms/ui'

/**
 * Above the Audios / Videos / Insights lists (admin.components.beforeListTable): how to reorder.
 * Adding is the list header's own "Create New". Dragging a row only works while the list is sorted
 * by position, and Payload remembers the last sort a person used, so a list could open sorted by
 * date with the drag handles greyed out. This opens the list in position order (once per visit, so
 * a deliberate sort afterwards is respected) and, while it is sorted any other way, offers a button
 * to go back. An empty list has nothing to order, so it says nothing.
 */
export function ListOrderHint() {
  const { data, handleSortChange, orderableFieldName, query } = useListQuery()
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

  if (data?.totalDocs === 0) return null

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
    </div>
  )
}
