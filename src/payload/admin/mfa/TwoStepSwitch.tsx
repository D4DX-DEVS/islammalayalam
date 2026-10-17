'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CheckboxFieldClientComponent } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { toast, useAuth, useConfig, useField, useModal } from '@payloadcms/ui'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { mfaStepOwed, SECURITY_SETTINGS, type MfaUser } from '@/lib/mfa-policy'
import { ConfirmDialog } from '@/payload/admin/enhancements/ConfirmDialog'
import { twoStepConfirm, twoStepStatus, twoStepToast } from './twoStepCopy'

const MODAL = 'im-two-step-confirm'
const STATUS_ID = 'im-two-step-status'

type PayloadErrorBody = { errors?: Array<{ message?: string }>; message?: string }

/**
 * Settings → Security, field `requireTwoFactor`. Replaces the plain tick box with one switch:
 * flipping it opens a confirmation in plain words and saves straight away (the global's Save
 * button is removed in config and its controls bar hidden in admin-security.scss).
 *
 * Saves through the same REST call the admin form would make, so access control, the afterChange
 * hooks (setting applied at once + audit log) and the session rules are unchanged. The form field
 * is updated afterwards without marking the form modified, so no "leave without saving?" prompt.
 */
export const TwoStepSwitch: CheckboxFieldClientComponent = ({ path, readOnly }) => {
  const { value, setValue, disabled } = useField<boolean>({ path })
  const { user } = useAuth()
  const { config } = useConfig()
  const { openModal } = useModal()
  const router = useRouter()
  const [next, setNext] = useState<boolean | null>(null)

  // Same rule as the server (src/payload/mfa.ts): anything but an explicit `false` means on.
  const on = value !== false
  const want = next ?? !on
  // What my own session would still owe once the step is required: the dialog says so.
  const myStep = user ? mfaStepOwed(user as MfaUser) : null
  const copy = twoStepConfirm(want, myStep)

  const ask = () => {
    setNext(!on)
    openModal(MODAL)
  }

  // Runs from the dialog's confirm button, which shows "Saving…" and closes itself afterwards.
  const save = async () => {
    try {
      const res = await fetch(
        formatAdminURL({ apiRoute: config.routes.api, path: `/globals/${SECURITY_SETTINGS}` }),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requireTwoFactor: want }),
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as PayloadErrorBody | null
        throw new Error(
          body?.errors?.[0]?.message || body?.message || `Could not save (${res.status})`,
        )
      }
      setValue(want, true)
      toast.success(twoStepToast(want))
      // Now on, my own session has to pass the step too. Re-rendering the admin layout lets the
      // server-side MfaProvider send me to the code or QR screen, as the dialog said.
      if (want) router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setNext(null)
    }
  }

  const Icon = on ? ShieldCheck : ShieldOff

  return (
    <div className={`im-two-step${on ? ' is-on' : ''}`}>
      <div className="im-two-step__icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="im-two-step__text">
        <h3 className="im-two-step__title">
          Two-step verification
          <span className="im-two-step__pill">{on ? 'On' : 'Off'}</span>
        </h3>
        <p className="im-two-step__status" id={STATUS_ID}>
          {twoStepStatus(on)}
        </p>
        <p className="im-two-step__hint">
          {on
            ? 'Turn it off only if staff cannot use an authenticator app for now.'
            : 'Turn it on so a stolen password alone is not enough to get into the admin.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Two-step verification"
        aria-describedby={STATUS_ID}
        disabled={readOnly || disabled}
        className="im-switch"
        onClick={ask}
      >
        <span className="im-switch__thumb" aria-hidden="true" />
      </button>
      <ConfirmDialog
        modalSlug={MODAL}
        tone={want ? 'brand' : 'danger'}
        icon={want ? <ShieldCheck /> : <ShieldOff />}
        heading={copy.heading}
        body={copy.body}
        confirmLabel={copy.confirmLabel}
        confirmingLabel="Saving…"
        cancelLabel="Keep as it is"
        onConfirm={save}
        onCancel={() => setNext(null)}
      />
    </div>
  )
}
