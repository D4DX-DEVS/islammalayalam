'use client'

import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 900

/**
 * A number that counts up from 0 the first time it scrolls into view. The server HTML (and anything
 * already on screen, reduced-motion visitors, no-JS) shows the final value, so it is never wrong.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el || value < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setShown(0)
    let frame = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS)
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <span ref={ref} className="tabular-nums">
      {shown}
    </span>
  )
}
