import { Eye } from 'lucide-react'
import { EXIT_PREVIEW_ROUTE } from '@/lib/preview'
import { ExitPreviewLink } from './ExitPreviewLink'
import { LivePreviewListener } from './LivePreviewListener'

/** Shown only to verified staff while preview (draft mode) is on. */
export function PreviewBar({ pathname }: { pathname: string }) {
  const exit = `${EXIT_PREVIEW_ROUTE}?${new URLSearchParams({ path: pathname }).toString()}`
  return (
    <div role="status" className="bg-accent text-white dark:text-brand-deep">
      <div className="mx-auto flex max-w-site items-center justify-between gap-3 px-4 py-1.5 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <Eye className="size-4" aria-hidden="true" />
          Preview — unpublished changes are visible
        </span>
        <ExitPreviewLink href={exit} />
      </div>
      <LivePreviewListener />
    </div>
  )
}
