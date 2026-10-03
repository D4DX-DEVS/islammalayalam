'use client'

import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

interface SectionTabsProps {
  titles: string[]
  panels: ReactNode[]
}

/**
 * KB page tabs (ഖുര്‍ആന്‍ സൂക്തങ്ങള്‍ / നബി വചനങ്ങള്‍ …) — WAI-ARIA tabs with arrow-key navigation.
 * All panels are server-rendered into the HTML (inactive ones `hidden`), so content stays indexable.
 */
export function SectionTabs({ titles, panels }: SectionTabsProps) {
  const [active, setActive] = useState(0)
  const base = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = titles.length - 1
    const next =
      e.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : e.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
    refs.current[next]?.focus()
  }

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="വിഭാഗങ്ങൾ"
        className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1.5"
      >
        {titles.map((title, i) => (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors ${active === i ? 'bg-card text-brand shadow-card' : 'text-body hover:text-brand'}`}
          >
            {title}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={active !== i}
          tabIndex={0}
          // Same reading surface as the page body (components/ui/ContentCard).
          className="mt-5 rounded-card bg-card p-5 shadow-card ring-1 ring-line/70 sm:p-8 lg:p-10"
        >
          {panel}
        </div>
      ))}
    </div>
  )
}
