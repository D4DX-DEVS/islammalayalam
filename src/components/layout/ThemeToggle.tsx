'use client'

import { Moon, Sun } from 'lucide-react'
import { THEME_COOKIE, type Theme } from '@/lib/theme'

/** Light/dark switch. Icons swap via CSS (`dark:`), so server and client markup always match. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement
    const current: Theme =
      root.dataset.theme === 'dark' ||
      (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light'
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    const secure = location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${secure}`
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="ഇരുണ്ട / തെളിഞ്ഞ മോഡ്"
      className={`inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface hover:text-brand ${className}`}
    >
      <Moon className="size-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-5 dark:block" aria-hidden="true" />
    </button>
  )
}
