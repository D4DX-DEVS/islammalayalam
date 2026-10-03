'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Inside the admin's live-preview iframe: tell the admin we are ready, then re-render from the
 * server whenever it reports a save/autosave (Payload's server-side live preview protocol).
 * Only messages from our own origin and our own parent frame are accepted; the form data the admin
 * also posts (`payload-live-preview`) is ignored — the server re-reads the draft with access checks.
 */
export function LivePreviewListener() {
  const router = useRouter()
  useEffect(() => {
    if (window.parent === window) return
    const origin = window.location.origin
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== window.parent) return
      const data: unknown = event.data
      if (
        data &&
        typeof data === 'object' &&
        (data as { type?: unknown }).type === 'payload-document-event'
      )
        router.refresh()
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'payload-live-preview', ready: true }, origin)
    return () => window.removeEventListener('message', onMessage)
  }, [router])
  return null
}
