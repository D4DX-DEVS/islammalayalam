'use client'

import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * "Exit preview", hidden inside the admin's live-preview iframe: there it would switch preview off
 * for the whole browser and leave the editor with a blocked (unframeable) page.
 */
export function ExitPreviewLink({ href }: { href: string }) {
  const framed = useSyncExternalStore(
    noop,
    () => window.parent !== window,
    () => false,
  )
  if (framed) return null
  return (
    // Plain <a>: a prefetch of the exit route would switch preview off (Next docs).
    <a
      href={href}
      className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline sm:min-h-0"
    >
      Exit preview
    </a>
  )
}
