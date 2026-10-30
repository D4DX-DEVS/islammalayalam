'use client'

import { useEffect, useRef } from 'react'

/**
 * A zero-height marker placed right above a sticky bar. While the marker is off screen the bar is
 * stuck to the top, and the bar (the next sibling) gets `data-stuck="true"` so CSS can react.
 */
export function StuckSentinel() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const marker = ref.current
    const bar = marker?.nextElementSibling as HTMLElement | null
    if (!marker || !bar) return
    const observer = new IntersectionObserver(([entry]) => {
      bar.dataset.stuck = entry && !entry.isIntersecting ? 'true' : 'false'
    })
    observer.observe(marker)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} aria-hidden="true" className="hidden h-0 xl:block" />
}
