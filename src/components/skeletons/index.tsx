import { Container } from '@/components/ui/Container'
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton'

export type SectionSkeletonVariant = 'hero' | 'split' | 'grid' | 'list' | 'band'

/** Skeletons mirror the real layouts (same grids, radii and aspect ratios) so nothing jumps on load. */
const CARD_FRAME = 'rounded-card bg-card shadow-card ring-1 ring-line/70'

function HeadingSkeleton() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Skeleton className="h-7 w-40" />
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}

export function ListRowSkeleton() {
  return (
    <div className={`flex gap-4 p-3 ${CARD_FRAME}`}>
      <Skeleton className="aspect-[4/3] w-24 shrink-0 rounded-xl sm:w-28" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className={`overflow-hidden ${CARD_FRAME}`}>
      <Skeleton className="aspect-[16/10] w-full !rounded-none" />
      <div className="space-y-3 p-4 sm:p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-8">
      <Skeleton className="aspect-[4/5] w-full rounded-card sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem]" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 4 }, (_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function SectionSkeleton({ variant = 'split' }: { variant?: SectionSkeletonVariant }) {
  if (variant === 'hero') return <HeroSkeleton />
  if (variant === 'band') {
    return (
      <div className="rounded-[1.75rem] bg-surface px-5 py-7 sm:px-8 sm:py-9">
        <HeadingSkeleton />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <section>
      <HeadingSkeleton />
      {variant === 'split' ? (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
          <CardSkeleton />
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <ListRowSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : null}
      {variant === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : null}
      {variant === 'list' ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <ListRowSkeleton key={i} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function HomeSkeleton() {
  return (
    <LoadingRegion>
      <Container className="space-y-14 py-6 lg:py-10">
        <SectionSkeleton variant="hero" />
        <SectionSkeleton variant="split" />
        <SectionSkeleton variant="grid" />
      </Container>
    </LoadingRegion>
  )
}

export function ArticleSkeleton() {
  return (
    <LoadingRegion>
      <Container className="py-6 lg:py-10">
        <div className="space-y-4">
          <Skeleton className="h-4 w-48" />
          <div className={`space-y-4 p-5 sm:p-8 lg:p-10 ${CARD_FRAME}`}>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mx-auto mt-6 aspect-[16/9] w-full max-w-5xl rounded-card" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </LoadingRegion>
  )
}

export function ListingSkeleton() {
  return (
    <LoadingRegion>
      <Container className="py-6 lg:py-10">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-8 h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {Array.from({ length: 12 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </Container>
    </LoadingRegion>
  )
}

export function PageSkeleton() {
  return (
    <LoadingRegion>
      <Container className="py-6 lg:py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            <div className={`space-y-4 p-5 sm:p-8 lg:p-10 ${CARD_FRAME}`}>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="flex gap-2 pt-4">
              <Skeleton className="h-11 w-40 rounded-full" />
              <Skeleton className="h-11 w-32 rounded-full" />
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <Skeleton className="hidden h-80 w-full rounded-[1.75rem] lg:block" />
        </div>
      </Container>
    </LoadingRegion>
  )
}
