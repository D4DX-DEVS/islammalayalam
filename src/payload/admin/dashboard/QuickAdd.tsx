'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CheckCircle2, Headphones, Loader2, Plus, TriangleAlert, Video } from 'lucide-react'
import { hasAnyField } from '@/lib/media-items'

/**
 * Quick add for the homepage's Audios and Videos: a link, a title and an author — every one of them
 * optional (at least one has to be filled in, or there would be nothing to save). Saves through
 * Payload's own REST API as the signed-in user, so access rules, link checks and the audit log apply
 * exactly as in the full editor, which stays one click away ("Edit").
 */
type Kind = 'audios' | 'videos'

const COPY = {
  audios: {
    heading: 'Add audio',
    icon: Headphones,
    linkLabel: 'Link',
    linkHint: 'Spotify link (plays in the player) or a direct https audio link',
    linkPlaceholder: 'https://open.spotify.com/episode/…',
    button: 'Add audio',
    noun: 'Audio',
  },
  videos: {
    heading: 'Add video',
    icon: Video,
    linkLabel: 'Link',
    linkHint: 'YouTube link (opens in a popup player)',
    linkPlaceholder: 'https://www.youtube.com/watch?v=…',
    button: 'Add video',
    noun: 'Video',
  },
} as const

type Result =
  | { tone: 'ok'; text: string; editHref: string }
  | { tone: 'error'; text: string }
  | null

function AddForm({ kind, api, adminBase }: { kind: Kind; api: string; adminBase: string }) {
  const copy = COPY[kind]
  const Icon = copy.icon
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const fields = {
      link: String(data.get('link') ?? '').trim(),
      title: String(data.get('title') ?? '').trim(),
      author: String(data.get('author') ?? '').trim(),
    }
    if (!hasAnyField(fields)) {
      setResult({ tone: 'error', text: 'Fill in at least one of link, title or author.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`${api}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const body = (await res.json().catch(() => null)) as {
        doc?: { id?: string | number; label?: string }
        errors?: Array<{ message?: string; data?: { errors?: Array<{ message?: string }> } }>
      } | null
      if (res.ok && body?.doc?.id !== undefined) {
        form.reset()
        setResult({
          tone: 'ok',
          text: `${copy.noun} added${body.doc.label ? `: ${body.doc.label}` : ''}.`,
          editHref: `${adminBase}/collections/${kind}/${body.doc.id}`,
        })
      } else {
        const message =
          body?.errors?.[0]?.data?.errors?.[0]?.message ??
          body?.errors?.[0]?.message ??
          (res.status === 403 ? 'You are not allowed to add this.' : 'Could not save. Try again.')
        setResult({ tone: 'error', text: message })
      }
    } catch {
      setResult({ tone: 'error', text: 'No connection. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="im-quick-add" onSubmit={submit} noValidate>
      <h3 className="im-quick-add__title">
        <span className="im-dash__panel-icon">
          <Icon aria-hidden="true" />
        </span>
        {copy.heading}
        <span className="im-quick-add__optional">all fields optional</span>
      </h3>
      <label className="im-quick-add__field">
        <span>{copy.linkLabel}</span>
        <input
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={500}
          placeholder={copy.linkPlaceholder}
        />
        <small>{copy.linkHint}</small>
      </label>
      <div className="im-quick-add__row">
        <label className="im-quick-add__field">
          <span>Title</span>
          <input name="title" type="text" autoComplete="off" maxLength={200} />
        </label>
        <label className="im-quick-add__field">
          <span>Author</span>
          <input name="author" type="text" autoComplete="off" maxLength={120} />
        </label>
      </div>
      <div className="im-quick-add__actions">
        <button type="submit" className="im-dash__btn im-dash__btn--primary" disabled={busy}>
          {busy ? (
            <Loader2 className="im-quick-add__spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {busy ? 'Saving…' : copy.button}
        </button>
        <Link href={`${adminBase}/collections/${kind}`} className="im-quick-add__all">
          All {copy.noun.toLowerCase()}s
        </Link>
      </div>
      <p
        className={`im-quick-add__result${result ? ` im-quick-add__result--${result.tone}` : ''}`}
        role={result?.tone === 'error' ? 'alert' : 'status'}
      >
        {result ? (
          <>
            {result.tone === 'ok' ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <TriangleAlert aria-hidden="true" />
            )}
            <span>
              {result.text}
              {result.tone === 'ok' ? (
                <>
                  {' '}
                  <Link href={result.editHref}>Edit</Link>
                </>
              ) : null}
            </span>
          </>
        ) : null}
      </p>
    </form>
  )
}

export function QuickAdd({
  api,
  adminBase,
  audio,
  video,
}: {
  /** Payload's REST route, e.g. "/api". */
  api: string
  adminBase: string
  /** The signed-in user may add audio / video. */
  audio: boolean
  video: boolean
}) {
  return (
    <div className={`im-quick-add-grid${audio && video ? ' im-quick-add-grid--two' : ''}`}>
      {audio ? <AddForm kind="audios" api={api} adminBase={adminBase} /> : null}
      {video ? <AddForm kind="videos" api={api} adminBase={adminBase} /> : null}
    </div>
  )
}
