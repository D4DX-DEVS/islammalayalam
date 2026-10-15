'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ChevronRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  User,
  UserCog,
} from 'lucide-react'

/**
 * The account dropdown card (presentation + its two small forms). The connected version, which
 * knows the signed-in user and talks to Payload's REST API, is AccountMenu.tsx.
 */
export interface AccountCardProps {
  email: string
  name: string
  role: string
  /** Whether an authenticator app is set up for this account. */
  totp: boolean
  /** Full Account page (everything the card does not cover). */
  accountHref: string
  logoutHref: string
  onSaveName: (name: string) => Promise<string | null>
  onSavePassword: (password: string) => Promise<string | null>
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const MIN_PASSWORD = 12

const initials = (name: string, email: string): string =>
  (name || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

function Row({ children }: { children: ReactNode }) {
  return <div className="im-account__row">{children}</div>
}

export function AccountCard({
  email,
  name,
  role,
  totp,
  accountHref,
  logoutHref,
  onSaveName,
  onSavePassword,
}: AccountCardProps) {
  const [mode, setMode] = useState<'main' | 'name' | 'password'>('main')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [draftName, setDraftName] = useState(name)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const back = () => {
    setMode('main')
    setError(null)
    setPassword('')
    setConfirm('')
  }

  async function submitName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const failure = await onSaveName(draftName.trim())
    setBusy(false)
    if (failure) return setError(failure)
    setDone('Name saved')
    back()
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    if ([...password].length < MIN_PASSWORD)
      return setError(`Use at least ${MIN_PASSWORD} characters.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    const failure = await onSavePassword(password)
    setBusy(false)
    if (failure) return setError(failure)
    setDone('Password changed')
    back()
  }

  return (
    <div className="im-account__card" role="dialog" aria-label="Your account">
      <header className="im-account__head">
        <span className="im-account__avatar im-account__avatar--lg" aria-hidden="true">
          {initials(name, email)}
        </span>
        <div className="im-account__who">
          <p className="im-account__name">{name || email.split('@')[0]}</p>
          <p className="im-account__email">{email}</p>
        </div>
        <span className="im-account__role">{ROLE_LABEL[role] ?? 'Staff'}</span>
      </header>

      {done && mode === 'main' ? (
        <p className="im-account__done" role="status">
          {done}
        </p>
      ) : null}

      {mode === 'main' ? (
        <ul className="im-account__list">
          <li>
            <button type="button" className="im-account__item" onClick={() => setMode('name')}>
              <User aria-hidden="true" />
              <span>
                <strong>Display name</strong>
                <small>{name || 'Not set'}</small>
              </span>
              <ChevronRight className="im-account__chev" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button type="button" className="im-account__item" onClick={() => setMode('password')}>
              <KeyRound aria-hidden="true" />
              <span>
                <strong>Change password</strong>
                <small>At least {MIN_PASSWORD} characters</small>
              </span>
              <ChevronRight className="im-account__chev" aria-hidden="true" />
            </button>
          </li>
          <li>
            <a className="im-account__item" href={accountHref}>
              {totp ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
              <span>
                <strong>Authenticator app</strong>
                <small>Two-step sign-in</small>
              </span>
              <span className={`im-account__badge${totp ? ' is-on' : ' is-off'}`}>
                {totp ? 'Configured' : 'Not set up'}
              </span>
            </a>
          </li>
          <li>
            <a className="im-account__item" href={accountHref}>
              <UserCog aria-hidden="true" />
              <span>
                <strong>All account settings</strong>
                <small>Email, language, preferences</small>
              </span>
              <ChevronRight className="im-account__chev" aria-hidden="true" />
            </a>
          </li>
        </ul>
      ) : null}

      {mode === 'name' ? (
        <form className="im-account__form" onSubmit={submitName}>
          <h3>Display name</h3>
          <label>
            <span>Name shown on your work</span>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={120}
              autoComplete="name"
              autoFocus
            />
          </label>
          {error ? (
            <p className="im-account__error" role="alert">
              {error}
            </p>
          ) : null}
          <Row>
            <button type="button" className="im-account__btn" onClick={back}>
              Cancel
            </button>
            <button
              type="submit"
              className="im-account__btn im-account__btn--primary"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </Row>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form className="im-account__form" onSubmit={submitPassword}>
          <h3>Change password</h3>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
              autoFocus
            />
          </label>
          <label>
            <span>Repeat new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error ? (
            <p className="im-account__error" role="alert">
              {error}
            </p>
          ) : null}
          <Row>
            <button type="button" className="im-account__btn" onClick={back}>
              Cancel
            </button>
            <button
              type="submit"
              className="im-account__btn im-account__btn--primary"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </Row>
        </form>
      ) : null}

      <footer className="im-account__foot">
        <a className="im-account__signout" href={logoutHref}>
          <LogOut aria-hidden="true" />
          Sign out
        </a>
      </footer>
    </div>
  )
}

export { initials as accountInitials }
