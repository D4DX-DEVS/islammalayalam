'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Round "back to top" button, shown after scrolling one screen. */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <a
      href="#top"
      aria-label="മുകളിലേക്ക്"
      className={`fixed bottom-5 end-5 z-40 inline-flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-lift transition duration-300 hover:bg-brand-strong ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </a>
  )
}
