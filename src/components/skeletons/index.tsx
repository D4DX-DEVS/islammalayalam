import { Container } from '@/components/ui/Container'
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton'

export type SectionSkeletonVariant =
  | 'hero'
  | 'split'
  | 'tiles'
  | 'grid'
  | 'list'
  | 'band'
  | 'shorts'
  | 'banner'

/** Skeletons mirror the real layouts (same grids, radii and aspect ratios) so nothing jumps on load. */
const CARD_FRAME = 'rounded-card bg-card shadow-card ring-1 ring-line/70'

function HeadingSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-28" />
    </div>
  )
}

export function ListRowSkeleton() {
  return (
    <div className={`flex gap-4 p-2 pe-4 ${CARD_FRAME}`}>
      <Skeleton className="aspect-[4/3] w-24 shrink-0 rounded-lg sm:w-28" />
      <div className="flex-1 space-y-2 py-1">
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
    <div className={`overflow-hidden p-2 ${CARD_FRAME}`}>
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      <div className="space-y-3 px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-7">
      <Skeleton className="aspect-[4/5] w-full rounded-2xl sm:aspect-[16/10] lg:aspect-auto lg:min-h-[30rem]" />
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
      <div className="bg-night py-8 sm:py-10">
        <Container>
          <div className="mb-6 flex items-center justify-between">
            <div className="h-8 w-40 animate-pulse rounded-md bg-white/15" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-white/15" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        </Container>
      </div>
    )
  }
  if (variant === 'banner') {
    return (
      <div className="aspect-[1200/200] animate-pulse rounded-card bg-line sm:aspect-[1200/160]" />
    )
  }
  if (variant === 'shorts') {
    return (
      <div className="rounded-panel bg-brand-soft/60 px-4 py-6 sm:px-7 sm:py-8">
        <div className="mb-6 h-8 w-40 animate-pulse rounded-md bg-line" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="w-[46%] shrink-0 sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
            >
              <div className="aspect-[9/16] animate-pulse rounded-2xl bg-line" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-line" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (variant === 'tiles') {
    return (
      <section>
        <HeadingSkeleton />
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }
  return (
    <section>
      <HeadingSkeleton />
      {variant === 'split' ? (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-6">
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
          <div className={`space-y-4 p-5 sm:p-10 lg:p-14 ${CARD_FRAME}`}>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mx-auto mt-6 aspect-[16/9] w-full max-w-5xl rounded-3xl" />
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
            <div className={`space-y-4 p-5 sm:p-10 lg:p-14 ${CARD_FRAME}`}>
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
          <Skeleton className="hidden h-80 w-full rounded-panel lg:block" />
        </div>
      </Container>
    </LoadingRegion>
  )
}
