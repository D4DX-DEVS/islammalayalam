'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Download, Share, X } from 'lucide-react'
import { INSTALL_DISMISS_KEY, installDismissed, isIosSafari } from '@/lib/pwa'

/** Chromium's install event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Mode = 'prompt' | 'ios' | null

const SHOW_AFTER = 4000

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

function readDismissed(): boolean {
  try {
    return installDismissed(localStorage.getItem(INSTALL_DISMISS_KEY), Date.now())
  } catch {
    return false
  }
}

/**
 * Small "Install the app" banner at the bottom, with the site emblem. Android/desktop Chromium:
 * Install opens the browser's own prompt. iPhone Safari has no prompt, so it explains Share → Add to
 * Home Screen. Never shown inside the installed app, and "Not now" hides it for two weeks.
 */
export function InstallBanner() {
  const [mode, setMode] = useState<Mode>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (standalone() || readDismissed()) return
    let timer: number | undefined
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMode('prompt'), SHOW_AFTER)
    }
    const onInstalled = () => setMode(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (isIosSafari(navigator.userAgent, navigator.maxTouchPoints))
      timer = window.setTimeout(() => setMode('ios'), SHOW_AFTER)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!mode) return null

  const dismiss = () => {
    setMode(null)
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
    } catch {
      // Private mode: it simply shows again next visit.
    }
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setMode(null)
    else dismiss()
  }

  return (
    <div
      role="dialog"
      aria-label="Install the app"
      className="dock-float fixed inset-x-0 z-50 mx-auto flex w-[calc(100%-1.5rem)] max-w-md items-center gap-3 rounded-2xl border border-line/70 bg-card p-3 shadow-lift enter"
    >
      <Image
        src="/brand/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-xl ring-1 ring-line"
      />
      <p className="min-w-0 flex-1 text-[0.8rem] leading-snug sm:text-sm">
        <span className="block truncate text-sm font-semibold text-ink">Islam Malayalam</span>
        {mode === 'ios' ? (
          <span className="text-muted">
            Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> then
            &ldquo;Add to Home Screen&rdquo;.
          </span>
        ) : (
          <span className="text-muted">Install the app for quick access.</span>
        )}
      </p>
      {mode === 'prompt' ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-sm font-semibold text-white shadow-card transition hover:opacity-90"
        >
          <Download className="hidden size-4 sm:block" aria-hidden="true" />
          Install
        </button>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="-me-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
