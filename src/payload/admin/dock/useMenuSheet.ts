'use client'

import { useEffect } from 'react'
import { sheetDismissed } from '@/lib/dock'

const PHONE = '(max-width: 768px)'
// Finger travel before the sheet starts to follow, so taps on its links stay taps.
const SLOP = 6

/**
 * The phone menu sheet (Payload's nav drawer, restyled in admin-menu-sheet.scss) while it is open:
 * a tap outside it (on the scrim) or Escape closes it, and pulling it down while its list is at the
 * top drags it along and closes it when let go far or fast enough (sheetDismissed).
 */
export function useMenuSheet(open: boolean, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!open || !window.matchMedia(PHONE).matches) return
    const sheet = document.querySelector<HTMLElement>('aside.nav')
    if (!sheet) return
    const scroller = sheet.querySelector<HTMLElement>('.nav__scroll')
    const atTop = () => (scroller?.scrollTop ?? 0) <= 0

    let startY = 0
    let startT = 0
    let dy = 0
    let dragging = false

    const reset = () => {
      sheet.style.transition = ''
      sheet.style.transform = ''
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // pointerdown, not click: the click that opened the sheet may still be on its way up. A dialog
    // opened from the sheet (Sign out?) is not "outside": Cancel brings you back to the menu.
    const onOutside = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || sheet.contains(e.target)) return
      if (e.target.closest('.payload__modal-item')) return
      setOpen(false)
    }
    const onStart = (e: TouchEvent) => {
      dragging = atTop() && e.touches.length === 1
      startY = e.touches[0]?.clientY ?? 0
      startT = e.timeStamp
      dy = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!dragging) return
      dy = (e.touches[0]?.clientY ?? startY) - startY
      // Scrolling the list (or back up past the start) is not a pull.
      if (dy < SLOP || !atTop()) {
        if (dy < 0 || !atTop()) dragging = false
        reset()
        return
      }
      if (e.cancelable) e.preventDefault()
      sheet.style.transition = 'none'
      sheet.style.transform = `translateY(${dy - SLOP}px)`
    }
    const onEnd = (e: TouchEvent) => {
      if (!dragging) return
      dragging = false
      reset()
      if (sheetDismissed(dy, e.timeStamp - startT)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside)
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onOutside)
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
      reset()
    }
  }, [open, setOpen])
}
