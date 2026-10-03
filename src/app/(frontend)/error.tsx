'use client'

import { RotateCw } from 'lucide-react'
import { Container } from '@/components/ui/Container'

/** Error boundary for public pages. Never shows the error message (may contain internals). */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Container className="py-12 lg:py-16">
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[1.75rem] bg-surface px-6 py-12 text-center"
      >
        <h1 className="text-2xl font-bold">എന്തോ പിശക് സംഭവിച്ചു</h1>
        <p className="text-sm text-muted">
          Something went wrong while loading this page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          വീണ്ടും ശ്രമിക്കുക
        </button>
      </div>
    </Container>
  )
}
