import type { ReactNode } from 'react'

/** The reading surface for an article or page body: a card with generous padding. */
export function ContentCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-card bg-card p-5 shadow-card ring-1 ring-line/70 sm:p-8 lg:p-10 ${className}`}
    >
      {children}
    </div>
  )
}
