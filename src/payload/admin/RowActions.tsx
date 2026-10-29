'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { toast, useAuth, useConfig, useModal } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import { ConfirmDialog } from './enhancements/ConfirmDialog'

/**
 * "Actions" column in admin lists: Edit (or View when read-only) and Delete with a confirmation.
 * Delete goes through Payload's REST API, so access control, hooks and the audit log apply exactly
 * as for Payload's own delete button. Buttons only show when the role has that permission; the
 * server re-checks (e.g. authors may only touch their own drafts).
 */
export function RowActions({ collectionSlug, rowData }: DefaultCellComponentProps) {
  const id = String(rowData.id ?? '')
  const { config } = useConfig()
  const { permissions } = useAuth()
  const { openModal, closeModal } = useModal()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!id) return null
  const access = permissions?.collections?.[collectionSlug]
  const canUpdate = Boolean(access?.update)
  const canDelete = Boolean(access?.delete)
  const modalSlug = `im-delete-${collectionSlug}-${id}`
  const editHref = `${config.routes.admin}/collections/${collectionSlug}/${encodeURIComponent(id)}`
  const title = rowTitle(rowData, config, collectionSlug)

  const remove = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${config.routes.api}/${collectionSlug}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(await errorMessage(res))
      toast.success(`Deleted “${title}”`)
      closeModal(modalSlug)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="im-row-actions">
      <Link
        href={editHref}
        className="im-row-actions__btn"
        aria-label={`${canUpdate ? 'Edit' : 'View'} ${title}`}
        title={canUpdate ? 'Edit' : 'View'}
      >
        {canUpdate ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
        <span className="im-row-actions__label">{canUpdate ? 'Edit' : 'View'}</span>
      </Link>
      {canDelete && (
        <>
          <button
            type="button"
            className="im-row-actions__btn im-row-actions__btn--danger"
            aria-label={`Delete ${title}`}
            title="Delete"
            disabled={busy}
            onClick={() => openModal(modalSlug)}
          >
            <Trash2 aria-hidden="true" />
            <span className="im-row-actions__label">Delete</span>
          </button>
          <ConfirmDialog
            tone="danger"
            icon={<Trash2 />}
            modalSlug={modalSlug}
            heading={`Delete “${title}”?`}
            body="This permanently removes it from the admin and the website. It cannot be undone."
            confirmLabel="Delete"
            confirmingLabel="Deleting…"
            onConfirm={remove}
          />
        </>
      )}
    </div>
  )
}

type Config = ReturnType<typeof useConfig>['config']

function rowTitle(row: Record<string, unknown>, config: Config, slug: string): string {
  const useAsTitle = config.collections.find((c) => c.slug === slug)?.admin?.useAsTitle
  const value = useAsTitle ? row[useAsTitle] : undefined
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  return text.trim() || 'this item'
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { errors?: { message?: string }[]; message?: string }
    return body.errors?.[0]?.message ?? body.message ?? `Delete failed (${res.status})`
  } catch {
    return `Delete failed (${res.status})`
  }
}
