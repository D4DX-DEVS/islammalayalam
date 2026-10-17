'use client'

import { useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Plus, TriangleAlert } from 'lucide-react'
import { hasAnyField } from '@/lib/media-items'

/**
 * Quick add for the homepage's Audio and Videos, inside the dashboard's Create panel: a link, and
 * optionally a title and an author. At least one of the three has to be filled in, or there would be
 * nothing to save. One form with an Audio / Video switch (only the kinds this role may add are
 * offered). It saves through Payload's own REST API as the signed-in user, so access rules, link
 * checks and the audit log apply exactly as in the full editor, which stays one click away ("Edit").
 */
type Kind = 'audios' | 'videos'

const COPY = {
  audios: {
    tab: 'Audio',
    noun: 'Audio',
    linkPlaceholder: 'Paste a Spotify or audio link',
    all: 'All audio',
  },
  videos: {
    tab: 'Video',
    noun: 'Video',
    linkPlaceholder: 'Paste a YouTube link',
    all: 'All videos',
  },
} as const

type Result =
  | { tone: 'ok'; text: string; editHref: string }
  | { tone: 'error'; text: string }
  | null

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
  const kinds: Kind[] = [
    ...(audio ? (['audios'] as const) : []),
    ...(video ? (['videos'] as const) : []),
  ]
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'audios')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const uid = useId()
  if (!kinds.length) return null
  const copy = COPY[kind]

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

  const choose = (next: Kind) => {
    setKind(next)
    setResult(null)
  }

  return (
    <form className="im-quick-add" onSubmit={submit} noValidate>
      <div className="im-quick-add__head">
        <h3 className="im-quick-add__title" id={`${uid}-title`}>
          Add audio or video
        </h3>
        {kinds.length > 1 ? (
          <div className="im-seg" role="group" aria-labelledby={`${uid}-title`}>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="im-seg__btn"
                aria-pressed={kind === k}
                onClick={() => choose(k)}
              >
                {COPY[k].tab}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="im-quick-add__line">
        <input
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={500}
          aria-label={`${copy.noun} link`}
          placeholder={copy.linkPlaceholder}
        />
        <button type="submit" className="im-dash__btn im-dash__btn--primary" disabled={busy}>
          {busy ? (
            <Loader2 className="im-quick-add__spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {busy ? 'Saving…' : 'Add'}
        </button>
      </div>

      <details className="im-quick-add__more">
        <summary>Add a title or author</summary>
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
      </details>

      <p className="im-quick-add__hint">
        Title and author are optional. New entries appear first on the homepage.{' '}
        <Link href={`${adminBase}/collections/${kind}`}>{copy.all}</Link>
      </p>

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
