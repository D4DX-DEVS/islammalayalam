'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useModal } from '@payloadcms/ui'
import { Globe, LockOpen, UserRound } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { confirmRuleFor, GUARDED_BUTTONS } from './confirmRules'
import type { ConfirmRule } from './confirmRules'
import { PasswordToggles } from './PasswordToggles'

const MODAL_SLUG = 'im-confirm-action'

const ICONS: Record<ConfirmRule['kind'], ReactNode> = {
  publish: <Globe />,
  account: <UserRound />,
  unlock: <LockOpen />,
}

/**
 * Admin-wide provider (admin.components.providers). Asks for confirmation before Publish / Save /
 * Force Unlock on the screens listed in confirmRules, and adds eye toggles to password fields.
 *
 * The guard listens in the capture phase on window, i.e. before React's own handler, so it also
 * catches Ctrl/Cmd+S (Payload's hotkey just clicks the same button). After "Confirm" the original
 * button is clicked again with the guard bypassed, so Payload's real save logic runs unchanged.
 */
export function AdminEnhancements({ children }: { children?: ReactNode }) {
  const { openModal, closeModal } = useModal()
  const [rule, setRule] = useState<ConfirmRule | null>(null)
  const pending = useRef<HTMLButtonElement | null>(null)
  const bypass = useRef(false)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (bypass.current || !(event.target instanceof Element)) return
      const button = event.target.closest<HTMLButtonElement>(GUARDED_BUTTONS)
      if (!button || button.disabled) return
      const next = confirmRuleFor(button.id, window.location.pathname, button.textContent ?? '')
      if (!next) return
      event.preventDefault()
      event.stopImmediatePropagation()
      pending.current = button
      setRule(next)
      openModal(MODAL_SLUG)
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [openModal])

  const confirm = () => {
    const button = pending.current
    pending.current = null
    closeModal(MODAL_SLUG)
    if (!button?.isConnected) return
    bypass.current = true
    try {
      button.click()
    } finally {
      bypass.current = false
    }
  }

  return (
    <>
      {children}
      <PasswordToggles />
      {rule && (
        <ConfirmDialog
          modalSlug={MODAL_SLUG}
          tone={rule.kind === 'unlock' ? 'danger' : 'brand'}
          icon={ICONS[rule.kind]}
          heading={rule.heading}
          body={rule.body}
          confirmLabel={rule.confirmLabel}
          onConfirm={confirm}
          onCancel={() => {
            pending.current = null
          }}
        />
      )}
    </>
  )
}
