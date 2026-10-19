import Link from 'next/link'
import { ArrowRight, CalendarDays, ChevronRight, UserRound } from 'lucide-react'
import { PostImage } from '@/components/cards/PostImage'
import { formatDate } from '@/lib/format'
import { postHref } from '@/lib/links'
import type { PostCardData } from '@/features/posts/queries'

export type CardVariant = 'lead' | 'feature' | 'grid' | 'list' | 'row' | 'side' | 'compact'

interface PostCardProps {
  post: PostCardData
  variant: CardVariant
  priority?: boolean
  headingLevel?: 'h2' | 'h3'
  /** Rank shown by the `compact` variant (1-based). */
  index?: number
  /** Hide the category label (e.g. inside that category's own section). */
  hideCategory?: boolean
  /** `grid` only: a thumbnail row on phones, a full card from `sm` (keeps long lists short on mobile). */
  compactOnMobile?: boolean
  /** `list` only: arrow at the end of the row. */
  chevron?: boolean
  /** `lead` and `row`: tighter (smaller picture, shorter titles) for a panel that must match a shorter neighbour. */
  dense?: boolean
}

export const categoryName = (post: PostCardData): string | null =>
  post.primaryCategory && typeof post.primaryCategory === 'object'
    ? post.primaryCategory.name
    : null

/** Author · calendar date (English). The card itself is the link, so the author is plain text. */
export function CardMeta({
  post,
  light,
  className = '',
}: {
  post: Pick<PostCardData, 'publishedAt' | 'author'>
  light?: boolean
  className?: string
}) {
  const date = formatDate(post.publishedAt)
  const author = post.author && typeof post.author === 'object' ? post.author.name : null
  if (!date && !author) return null
  return (
    <p
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs ${light ? 'text-white/85' : 'text-muted'} ${className}`}
    >
      {author ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
          <span className="truncate">{author}</span>
        </span>
      ) : null}
      {date ? (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
          <time dateTime={post.publishedAt ?? undefined} lang="en">
            {date}
          </time>
        </span>
      ) : null}
    </p>
  )
}

function Kicker({ name, pill, soft }: { name: string | null; pill?: boolean; soft?: boolean }) {
  if (!name) return null
  if (soft)
    return (
      <span className="inline-flex w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
        {name}
      </span>
    )
  return pill ? (
    <span className="inline-flex w-fit rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
      {name}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
      {name}
    </span>
  )
}

const TITLE_HOVER = 'transition-colors group-hover:text-brand'
/** Every card: white surface, hairline ring and soft shadow; lifts with a blue-tinted shadow on hover/focus. */
export const CARD =
  'rounded-card bg-card shadow-card ring-1 ring-line/60 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand/30 focus-visible:-translate-y-0.5 focus-visible:shadow-lift motion-reduce:transform-none motion-reduce:transition-none'

/** One card, six layouts: navy lead, horizontal feature, grid, list row, news row, ranked compact. */
export function PostCard({
  post,
  variant,
  priority,
  headingLevel: H = 'h3',
  index,
  hideCategory,
  compactOnMobile,
  chevron,
  dense,
}: PostCardProps) {
  const href = postHref(post.postNumber) ?? '#'
  const cat = hideCategory ? null : categoryName(post)
  const img = { ...post, categoryName: categoryName(post) }

  if (variant === 'lead') {
    return (
      <Link
        href={href}
        data-reveal="zoom"
        suppressHydrationWarning
        className={`group relative isolate flex h-full ${dense ? 'min-h-[18rem]' : 'min-h-[22rem]'} flex-col justify-end overflow-hidden rounded-card bg-brand-deep shadow-card ring-1 ring-black/5 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5 motion-reduce:transform-none`}
      >
        <PostImage
          post={img}
          size="large"
          sizes="(min-width: 1280px) 460px, (min-width: 1024px) 40vw, 100vw"
          priority={priority}
          cover
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#041d4d] via-[#0a3f8f]/70 to-[#0a3f8f]/5" />
        <div className="relative space-y-3 p-5 sm:p-6">
          <Kicker name={categoryName(post)} pill />
          <H className="line-clamp-3 text-xl font-bold leading-snug text-white sm:text-[1.55rem]">
            {post.title}
          </H>
          {post.excerpt ? (
            <p
              className={`text-sm leading-relaxed text-white/85 ${dense ? 'line-clamp-2' : 'line-clamp-3'}`}
            >
              {post.excerpt}
            </p>
          ) : null}
          <CardMeta post={post} light className="border-t border-white/20 pt-3.5" />
        </div>
      </Link>
    )
  }

  // `row`: the list beside a lead card — a roomier picture, so the stack reads as a column of stories.
  if (variant === 'row') {
    return (
      <Link
        href={href}
        data-reveal="up"
        suppressHydrationWarning
        className={`group flex items-center gap-3.5 p-2 pe-4 ${dense ? 'sm:gap-4 sm:p-2 sm:pe-4' : 'sm:gap-5 sm:p-2.5 sm:pe-5'} ${CARD}`}
      >
        <PostImage
          post={img}
          size="card"
          sizes="(min-width: 640px) 168px, 112px"
          className={`aspect-[4/3] shrink-0 rounded-xl ${dense ? 'w-28 sm:w-32' : 'w-28 sm:w-40'}`}
        />
        <div className="min-w-0 flex-1 space-y-2 py-1">
          <Kicker name={cat} soft />
          <H
            className={`font-display font-semibold leading-snug text-ink ${dense ? 'line-clamp-2 text-[0.95rem] sm:text-base' : 'line-clamp-3 text-[0.97rem] sm:text-[1.05rem]'} ${TITLE_HOVER}`}
          >
            {post.title}
          </H>
          <CardMeta post={post} />
        </div>
      </Link>
    )
  }

  if (variant === 'side' || variant === 'list') {
    const side = variant === 'side'
    return (
      <Link
        href={href}
        data-reveal={side ? 'right' : 'up'}
        suppressHydrationWarning
        className={`group flex items-center gap-3.5 p-2 pe-3.5 sm:gap-4 ${CARD}`}
      >
        <PostImage
          post={img}
          size="thumb"
          sizes="160px"
          className={`aspect-[4/3] shrink-0 rounded-lg ${side ? 'w-24 sm:w-36' : 'w-24 sm:w-28'}`}
        />
        <div className="min-w-0 flex-1 space-y-2 py-1">
          <Kicker name={cat} />
          <H
            className={`line-clamp-3 font-display font-semibold leading-snug text-ink ${TITLE_HOVER} ${side ? 'text-[0.97rem] sm:text-base' : 'text-[0.97rem]'}`}
          >
            {post.title}
          </H>
          <CardMeta post={post} />
        </div>
        {chevron ? (
          <ChevronRight
            className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand rtl:rotate-180"
            aria-hidden="true"
          />
        ) : null}
      </Link>
    )
  }

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="group -m-2 flex items-start gap-4 rounded-xl p-2 transition-colors hover:bg-card hover:shadow-card"
      >
        {index ? (
          <span
            className="w-10 shrink-0 bg-gradient-to-b from-brand-glow to-brand bg-clip-text font-display text-3xl font-bold leading-none text-transparent tabular-nums opacity-60"
            aria-hidden="true"
          >
            {String(index).padStart(2, '0')}
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <H
            className={`line-clamp-3 text-[0.97rem] font-semibold leading-snug text-ink ${TITLE_HOVER}`}
          >
            {post.title}
          </H>
          <CardMeta post={post} />
        </div>
      </Link>
    )
  }

  if (variant === 'feature') {
    return (
      <Link
        href={href}
        data-reveal="left"
        suppressHydrationWarning
        className={`group grid h-full overflow-hidden sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] ${CARD}`}
      >
        <PostImage
          post={img}
          size="large"
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 100vw"
          priority={priority}
          className="aspect-[16/10] sm:aspect-auto sm:h-full sm:min-h-72"
        />
        <div className="flex flex-col justify-center gap-3 p-5 sm:p-7">
          <Kicker name={categoryName(post)} pill />
          <H className={`text-xl font-bold leading-snug text-ink sm:text-[1.65rem] ${TITLE_HOVER}`}>
            {post.title}
          </H>
          {post.excerpt ? (
            <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-body">{post.excerpt}</p>
          ) : null}
          <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all group-hover:gap-3 group-hover:bg-brand-strong">
            Read more
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </span>
        </div>
      </Link>
    )
  }

  const row = compactOnMobile
  return (
    <Link
      href={href}
      data-reveal="up"
      suppressHydrationWarning
      className={`group flex h-full overflow-hidden p-2 ${CARD} ${row ? 'items-start gap-4 sm:flex-col sm:gap-0' : 'flex-col'}`}
    >
      <PostImage
        post={img}
        size="card"
        sizes={`(min-width: 1024px) 400px, (min-width: 640px) 50vw, ${row ? '128px' : '100vw'}`}
        priority={priority}
        className={
          row
            ? 'aspect-[4/3] w-28 shrink-0 rounded-lg sm:aspect-[16/10] sm:w-full'
            : 'aspect-[16/10] rounded-lg'
        }
      />
      <div
        className={`min-w-0 flex-1 space-y-2.5 ${row ? 'py-1 pe-2 sm:px-3 sm:pb-3 sm:pt-4' : 'px-2.5 pb-3 pt-4'}`}
      >
        <Kicker name={cat} />
        <H
          className={`line-clamp-3 font-bold leading-snug text-ink ${TITLE_HOVER} ${row ? 'text-[0.97rem] sm:text-[1.05rem]' : 'text-[1.05rem]'}`}
        >
          {post.title}
        </H>
        <CardMeta post={post} />
      </div>
    </Link>
  )
}
