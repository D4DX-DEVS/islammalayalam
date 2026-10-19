'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  Button,
  SaveButton,
  toast,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormModified,
} from '@payloadcms/ui'
import { hasAnyField } from '@/lib/media-items'

/**
 * Buttons of the Audio / Video / Insight editor (admin.components.edit.SaveButton): "Back" to the
 * list, Payload's own "Save", and "Add Video" / "Add Audio" / "Add Poster" (on an existing entry:
 * "Add New"). "Add" saves the entry and then opens a blank form, so several can be added one after
 * another. It goes through the form's own submit, so the checks, field errors, access rules and the
 * audit log are exactly the same as for "Save".
 */
const COPY = {
  audios: { noun: 'Audio', empty: 'Fill in at least one of link, title or author.' },
  videos: { noun: 'Video', empty: 'Fill in at least one of link, title or author.' },
  quotes: { noun: 'Poster', empty: 'Upload a poster image or write some text first.' },
} as const

type Entry = { link?: string; title?: string; author?: string; poster?: unknown; text?: string }

/** A brand-new entry needs something in it, or there would be nothing to show. */
const isBlank = (slug: string | undefined, data: Entry): boolean =>
  slug === 'quotes' ? !data.poster && !data.text?.trim() : !hasAnyField(data)

export function SaveButtons() {
  const { collectionSlug, id } = useDocumentInfo()
  const { config } = useConfig()
  const { getData, setModified, submit } = useForm()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const copy = COPY[collectionSlug as keyof typeof COPY] ?? {
    noun: 'item',
    empty: 'Fill in the form first.',
  }
  const editing = Boolean(id)
  const base = `${config.routes.admin}/collections/${collectionSlug}`

  async function addAnother() {
    if (!editing && isBlank(collectionSlug, getData() as Entry)) {
      toast.error(copy.empty)
      return
    }
    setBusy(true)
    try {
      // An existing entry with no changes has nothing to save: just open the blank form.
      if (!editing || modified) {
        const result = await submit()
        if (!result?.res || result.res.status >= 400) return // the form is showing what to fix
        setModified(false)
      }
      // A full load, so the blank form starts from scratch (nothing left over from this one).
      window.location.assign(new URL(`${base}/create`, window.location.origin))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button buttonStyle="secondary" size="medium" el="link" to={base} id="action-back">
        <ArrowLeft
          aria-hidden="true"
          style={{ width: '1rem', height: '1rem', marginInlineEnd: '0.35rem' }}
        />
        Back
      </Button>
      <SaveButton />
      <Button
        buttonStyle="secondary"
        size="medium"
        type="button"
        id="action-add-another"
        disabled={busy}
        onClick={() => void addAnother()}
        tooltip={editing ? 'Save, then start a new one' : 'Save, then clear the form for the next'}
      >
        {busy ? 'Saving…' : editing ? 'Add New' : `Add ${copy.noun}`}
      </Button>
    </>
  )
}
