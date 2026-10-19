import type { ReactNode } from 'react'

/** The reading surface for an article or page body: a card with standard padding. */
export function ContentCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-panel bg-card p-4 shadow-card ring-1 ring-line/70 sm:p-6 lg:p-8 ${className}`}
    >
      {children}
    </div>
  )
}
