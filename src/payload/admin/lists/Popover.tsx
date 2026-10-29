'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

type PopoverProps = {
  /** Accessible name of the panel. */
  label: string
  /** The element holding the trigger and this panel: presses outside it close the panel. */
  anchor: RefObject<HTMLElement | null>
  /** Called with true when focus should go back to the trigger (Escape, backdrop, Done). */
  onClose: (restoreFocus: boolean) => void
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}

/**
 * A small panel under a toolbar button. On a desktop it drops down beside the button; on a phone
 * it is a sheet above the bottom bar with a backdrop that closes it, so a stray tap never opens a
 * post underneath. On opening, [data-autofocus] (else the first field) gets focus; on a touch
 * screen the panel itself does, so the keyboard does not cover the sheet.
 */
export function Popover({ label, anchor, onClose, align = 'start', className, children }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const root = panel.current
    const touch = window.matchMedia('(pointer: coarse)').matches
    const target = touch
      ? root
      : (root?.querySelector<HTMLElement>('[data-autofocus]') ??
        root?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled])'))
    target?.focus({ preventScroll: true })
    const onPointer = (e: PointerEvent) => {
      if (anchor.current && !anchor.current.contains(e.target as Node)) closeRef.current(false)
    }
    // Capture phase: runs before the drawer's own Escape handler on document, so Escape closes this
    // panel only, not the relationship drawer around the list.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeRef.current(true)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchor])

  return (
    <>
      <div className="im-pop-backdrop" aria-hidden="true" onClick={() => onClose(true)} />
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        className={`im-pop im-pop--${align}${className ? ` ${className}` : ''}`}
      >
        {children}
      </div>
    </>
  )
}
