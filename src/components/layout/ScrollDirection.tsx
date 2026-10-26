'use client'

import { useEffect } from 'react'
import { nextScrollDir, type ScrollDir } from '@/lib/pwa'

/**
 * Sets <html data-scroll="up|down"> as the visitor scrolls. globals.css slides the mobile header up
 * and the bottom dock down while it is "down" (Facebook-style) and brings both back on scroll up.
 * Below `xl` only; one rAF-throttled passive listener for the whole site.
 */
export function ScrollDirection() {
  useEffect(() => {
    const root = document.documentElement
    let dir: ScrollDir = 'up'
    let lastY = window.scrollY
    let frame = 0
    const apply = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const next = nextScrollDir(dir, lastY, y)
      // Only advance the baseline once the move counted, so slow scrolls still add up.
      if (next !== dir || Math.abs(y - lastY) >= 8) lastY = y
      if (next !== dir) root.dataset.scroll = dir = next
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    root.dataset.scroll = dir
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
      delete root.dataset.scroll
    }
  }, [])
  return null
}
