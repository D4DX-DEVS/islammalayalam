interface SkeletonProps {
  className?: string
}

/** Shimmering placeholder block. Decorative only — the loading region carries the aria label. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-line)_50%,var(--color-surface)_75%)] bg-[length:200%_100%] ${className}`}
    />
  )
}

/** Wraps a skeleton layout so assistive tech announces loading once. */
export function LoadingRegion({
  label = 'ലോഡ് ചെയ്യുന്നു…',
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
