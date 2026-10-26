'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { SKIP_WAITING, SW_PATH } from '@/lib/pwa'

const CHECK_EVERY = 30 * 60_000

/**
 * Registers /sw.js (production only: a caching worker fights dev HMR) and watches for a new deploy.
 * A new worker installs, then waits; this shows "New version available · Update". Update — or the
 * app going to the background while one is waiting — activates it, and the page reloads once.
 * Installed apps rarely reload on their own, so it also re-checks on focus and every 30 minutes.
 */
export function PwaUpdater() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | undefined
    let reloading = false
    // Only reload for a real update: the very first install also fires controllerchange (claim()).
    const hadController = Boolean(navigator.serviceWorker.controller)

    const track = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) setWaiting(next)
        })
      })
    }
    const onControllerChange = () => {
      if (!hadController || reloading) return
      reloading = true
      window.location.reload()
    }
    const check = () => {
      registration?.update().catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') return check()
      // Backgrounded with an update waiting: apply it now, the next open is already fresh.
      if (registration?.waiting && navigator.serviceWorker.controller)
        registration.waiting.postMessage(SKIP_WAITING)
    }

    navigator.serviceWorker
      .register(SW_PATH, { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        registration = reg
        track(reg)
      })
      .catch(() => {})
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(check, CHECK_EVERY)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [])

  if (!waiting || dismissed) return null

  const update = () => {
    setUpdating(true)
    waiting.postMessage(SKIP_WAITING)
    // Safety net if controllerchange never arrives (worker already active elsewhere).
    window.setTimeout(() => window.location.reload(), 4000)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="dock-float fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line/70 bg-card p-3 shadow-lift sm:inset-x-auto sm:start-5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <RefreshCw className={`size-5 ${updating ? 'animate-spin' : ''}`} aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-[0.8rem] leading-snug sm:text-sm">
        <span className="block truncate text-sm font-semibold text-ink">Update available</span>
        <span className="text-muted">Tap Update to load the latest.</span>
      </p>
      <button
        type="button"
        onClick={update}
        disabled={updating}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-card transition hover:opacity-90 disabled:opacity-70"
      >
        {updating ? 'Updating…' : 'Update'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Later"
        className="-me-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
