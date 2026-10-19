'use client'

import type { ReactNode } from 'react'
import { ConfirmationModal } from '@payloadcms/ui'

export type DialogTone = 'brand' | 'danger'

export interface ConfirmDialogProps {
  modalSlug: string
  /** `danger` for actions that weaken security or cannot be undone; the confirm button turns red. */
  tone?: DialogTone
  /** A lucide icon; shown in a tinted circle above the heading. */
  icon: ReactNode
  heading: string
  body: ReactNode
  confirmLabel: string
  /** Shown on the confirm button while `onConfirm` is running. */
  confirmingLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel?: () => void
}

/**
 * The admin's confirmation dialog: Payload's ConfirmationModal underneath (focus trap, Esc,
 * stacking inside drawers, busy state while confirming) with our own layout, styled by
 * app/(payload)/admin-dialog.scss. Open it with `useModal().openModal(modalSlug)`.
 */
export function ConfirmDialog({
  modalSlug,
  tone = 'brand',
  icon,
  heading,
  body,
  confirmLabel,
  confirmingLabel = 'Please wait…',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ConfirmationModal
      modalSlug={modalSlug}
      className={`im-dialog im-dialog--${tone}`}
      heading={
        <div className="im-dialog__head">
          <span className="im-dialog__icon" aria-hidden="true">
            {icon}
          </span>
          <h1 className="im-dialog__title">{heading}</h1>
        </div>
      }
      body={typeof body === 'string' ? <p className="im-dialog__body">{body}</p> : body}
      confirmLabel={confirmLabel}
      confirmingLabel={confirmingLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
