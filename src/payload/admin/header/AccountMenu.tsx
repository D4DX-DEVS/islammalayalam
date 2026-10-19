'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useConfig } from '@payloadcms/ui'
import { AccountCard, accountInitials } from './AccountCard'

type StaffUser = {
  id: string | number
  email: string
  name?: string | null
  role?: string | null
  hasTotp?: boolean | null
}

/**
 * The account button on the right of the admin header: it opens the account card as a dropdown
 * instead of navigating to the Account page. Saving goes to Payload's own REST API as the signed-in
 * user, so access control, the 12+ character password policy and the audit log all apply as usual.
 */
export function AccountMenu() {
  const { user } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const me = user as StaffUser | null
  if (!me) return null

  const admin = config.routes.admin
  const api = `${config.serverURL ?? ''}${config.routes.api}`
  const accountHref = `${admin}${config.admin.routes.account}`
  const logoutHref = `${admin}${config.admin.routes.logout ?? '/logout'}`
  const shownName = name ?? me.name ?? ''

  /** PATCH the signed-in user; resolves to an error message, or null on success. */
  const save = async (body: Record<string, string>): Promise<string | null> => {
    try {
      const res = await fetch(`${api}/users/${me.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return null
      const data = (await res.json().catch(() => null)) as {
        errors?: Array<{ message?: string; data?: { errors?: Array<{ message?: string }> } }>
      } | null
      return (
        data?.errors?.[0]?.data?.errors?.[0]?.message ??
        data?.errors?.[0]?.message ??
        'Could not save. Try again.'
      )
    } catch {
      return 'No connection. Try again.'
    }
  }

  return (
    <div className="im-account" ref={root}>
      <button
        ref={button}
        type="button"
        className="im-account__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="im-account__avatar" aria-hidden="true">
          {accountInitials(shownName, me.email)}
        </span>
      </button>
      {open ? (
        <AccountCard
          email={me.email}
          name={shownName}
          role={me.role ?? ''}
          totp={Boolean(me.hasTotp)}
          accountHref={accountHref}
          logoutHref={logoutHref}
          onSaveName={async (next) => {
            const failure = await save({ name: next })
            if (!failure) {
              setName(next)
              router.refresh()
            }
            return failure
          }}
          onSavePassword={(password) => save({ password })}
        />
      ) : null}
    </div>
  )
}
