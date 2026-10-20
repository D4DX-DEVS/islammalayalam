'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast, useConfig } from '@payloadcms/ui'
import { moveBlock } from './reorder'

/**
 * Up / down arrows on a homepage section in the Website manager. They change the section's place in
 * the Homepage layout through Payload's own global endpoint — the same save the Homepage editor
 * makes — so access rules, the audit log and the site's cache purge are the same whichever is used.
 */
export function MoveSection({
  field,
  id,
  first,
  last,
  label,
}: {
  field: 'layout' | 'sidebar'
  id: string
  first: boolean
  last: boolean
  label: string
}) {
  const { config } = useConfig()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function move(delta: -1 | 1) {
    setBusy(true)
    try {
      const api = `${config.routes.api}/globals/homepage`
      // Read the layout as it is now, so a change made meanwhile elsewhere is not overwritten.
      const read = await fetch(`${api}?depth=0`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!read.ok) throw new Error('Could not read the homepage. Try again.')
      const doc = (await read.json()) as Record<string, { id?: string | null }[] | undefined>
      const next = moveBlock(doc[field] ?? [], id, delta)
      if (!next) {
        toast.info(delta < 0 ? `“${label}” is already first.` : `“${label}” is already last.`)
        return
      }
      const save = await fetch(api, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (!save.ok) throw new Error('Could not save the new order. Try again.')
      toast.success(`Moved “${label}” ${delta < 0 ? 'up' : 'down'}.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not move the section.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="im-site__move" role="group" aria-label={`Move ${label}`}>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={busy || first}
        aria-label={`Move ${label} up`}
        title="Move up"
      >
        <ChevronUp aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={busy || last}
        aria-label={`Move ${label} down`}
        title="Move down"
      >
        <ChevronDown aria-hidden="true" />
      </button>
    </span>
  )
}
