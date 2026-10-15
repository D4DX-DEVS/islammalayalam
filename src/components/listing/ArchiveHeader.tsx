import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from '@/components/article/Breadcrumbs'

interface ArchiveHeaderProps {
  kicker: string
  title: string
  crumbs: Crumb[]
  description?: ReactNode
  count?: number | null
  children?: ReactNode
}

/** Header band for category, author and search pages. */
export function ArchiveHeader({
  kicker,
  title,
  crumbs,
  description,
  count,
  children,
}: ArchiveHeaderProps) {
  return (
    <header className="relative isolate mb-12 overflow-hidden rounded-panel bg-gradient-to-br from-brand-soft via-surface to-surface px-6 py-8 ring-1 ring-line/60 sm:px-12 sm:py-12">
      <Breadcrumbs items={crumbs} className="mb-6" />
      <p className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3.5 py-1 text-sm font-semibold text-brand ring-1 ring-line/70 backdrop-blur">
        <span
          className="size-2 rotate-45 rounded-[2px] bg-gradient-to-br from-accent to-brand-glow"
          aria-hidden="true"
        />
        {kicker}
      </p>
      <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{title}</h1>
      {description ? <div className="mt-3 max-w-3xl text-body">{description}</div> : null}
      {typeof count === 'number' ? (
        <p className="mt-5 text-sm font-medium text-muted">{count} ലേഖനങ്ങൾ</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  )
}
