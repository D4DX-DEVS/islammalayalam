'use client'

import { useTheme } from '@payloadcms/ui'
import { Moon, Sun } from 'lucide-react'

/**
 * Light/dark switch on the right of the admin header. It replaces the "Admin Theme" radio buttons of
 * the Account page and uses the same Payload theme provider, so the choice is remembered (cookie)
 * exactly as before.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={`im-theme-switch${dark ? ' is-dark' : ''}`}
    >
      <Sun className="im-theme-switch__icon im-theme-switch__icon--sun" aria-hidden="true" />
      <Moon className="im-theme-switch__icon im-theme-switch__icon--moon" aria-hidden="true" />
      <span className="im-theme-switch__thumb" aria-hidden="true" />
    </button>
  )
}
