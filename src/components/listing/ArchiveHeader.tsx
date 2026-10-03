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
    <header className="relative isolate mb-10 overflow-hidden rounded-[1.75rem] bg-surface px-5 py-7 sm:px-10 sm:py-10">
      <div
        className="mask-star-lattice pointer-events-none absolute inset-y-0 end-0 -z-10 w-2/3 bg-brand opacity-[0.07]"
        aria-hidden="true"
      />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <p className="text-sm font-semibold text-brand">{kicker}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-[2.6rem]">{title}</h1>
      {description ? <div className="mt-3 max-w-3xl text-body">{description}</div> : null}
      {typeof count === 'number' ? (
        <p className="mt-4 text-sm font-medium text-muted">{count} ലേഖനങ്ങൾ</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  )
}
