'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast, useAuth, useConfig, useListQuery } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

/**
 * "Move" column of the Audios / Videos lists: arrows that move an entry one place up or down, next
 * to the drag handle. Both end in Payload's own reorder endpoint, so access rules, the audit log
 * and the site's cache purge behave the same whichever is used.
 *
 * Up = toward the top of the list as it is shown (the top row is the first one on the site). When
 * the list is sorted by some other column, up means earlier on the site.
 */
type Neighbour = { id: string | number; _order?: string | null }

export function MoveArrows({ collectionSlug, rowData }: DefaultCellComponentProps) {
  const id = rowData.id as string | number | undefined
  const key = typeof rowData._order === 'string' ? rowData._order : null
  const { config } = useConfig()
  const { permissions } = useAuth()
  const { data, query } = useListQuery()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (id === undefined || !permissions?.collections?.[collectionSlug]?.update) return null

  // Sorted by position (best first, "-_order") the top row has the greatest key; ascending is the reverse.
  const topIsGreater = query?.sort !== '_order'
  const sortedByPosition = query?.sort === '_order' || query?.sort === '-_order'
  const docs = (data?.docs ?? []) as Array<{ id: string | number }>
  const index = docs.findIndex((doc) => String(doc.id) === String(id))
  const atTop = sortedByPosition && index === 0 && !data?.hasPrevPage
  const atBottom = sortedByPosition && index === docs.length - 1 && !data?.hasNextPage

  async function move(direction: 'up' | 'down') {
    if (!key) {
      toast.error('This entry has no position yet. Drag it once to give it one, then try again.')
      return
    }
    const wantGreater = (direction === 'up') === topIsGreater
    setBusy(true)
    try {
      // The entry that is next to this one in that direction, wherever it is in the list or page.
      const params = new URLSearchParams({
        limit: '1',
        depth: '0',
        sort: wantGreater ? '_order' : '-_order',
        [`where[_order][${wantGreater ? 'greater_than' : 'less_than'}]`]: key,
      })
      const found = await fetch(`${config.routes.api}/${collectionSlug}?${params}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!found.ok) throw new Error('Could not read the list. Try again.')
      const next = ((await found.json()) as { docs?: Neighbour[] }).docs?.[0]
      if (!next?._order) {
        toast.info(
          direction === 'up' ? 'It is already at the top.' : 'It is already at the bottom.',
        )
        return
      }
      const res = await fetch(`${config.routes.api}/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionSlug,
          docsToMove: [id],
          newKeyWillBe: wantGreater ? 'greater' : 'less',
          orderableFieldName: '_order',
          target: { id: next.id, key: next._order },
        }),
      })
      if (res.status === 403) throw new Error('You do not have permission to reorder these.')
      if (!res.ok) throw new Error('Could not move it. Try again.')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not move it. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="im-move">
      <button
        type="button"
        className="im-move__btn"
        aria-label="Move up"
        title="Move up"
        disabled={busy || atTop}
        onClick={() => void move('up')}
      >
        <ChevronUp aria-hidden="true" />
      </button>
      <button
        type="button"
        className="im-move__btn"
        aria-label="Move down"
        title="Move down"
        disabled={busy || atBottom}
        onClick={() => void move('down')}
      >
        <ChevronDown aria-hidden="true" />
      </button>
    </div>
  )
}
