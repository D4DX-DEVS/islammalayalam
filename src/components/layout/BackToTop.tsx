'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Round "back to top" button, shown after scrolling one screen. */
export function BackToTop({ raised = false }: { raised?: boolean }) {
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
      aria-label="Back to top"
      className={`fixed end-4 z-40 sm:end-5 ${raised ? 'bottom-20 sm:bottom-[5.5rem]' : 'bottom-4 sm:bottom-5'} bg-brand-gradient inline-flex size-12 items-center justify-center rounded-full text-white shadow-lift ring-1 ring-white/20 transition duration-300 hover:-translate-y-0.5 ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </a>
  )
}
