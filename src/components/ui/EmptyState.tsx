import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: { href: string; label: string }
  icon?: LucideIcon
}

export function EmptyState({ title, description, action, icon: Icon = FileText }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-line bg-surface px-6 py-16 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-brand-soft text-brand">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="bg-brand-gradient mt-2 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
