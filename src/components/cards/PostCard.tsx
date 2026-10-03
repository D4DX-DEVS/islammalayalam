import Link from 'next/link'
import { PostImage } from '@/components/cards/PostImage'
import { formatDate, readingLabel } from '@/lib/format'
import { postHref } from '@/lib/links'
import type { PostCardData } from '@/features/posts/queries'

export type CardVariant = 'hero' | 'lead' | 'feature' | 'grid' | 'list' | 'side' | 'compact'

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
}

export const categoryName = (post: PostCardData): string | null =>
  post.primaryCategory && typeof post.primaryCategory === 'object'
    ? post.primaryCategory.name
    : null

/** Date · reading time. */
export function CardMeta({
  post,
  light,
  className = '',
}: {
  post: Pick<PostCardData, 'publishedAt' | 'readingMinutes'>
  light?: boolean
  className?: string
}) {
  const date = formatDate(post.publishedAt)
  const reading = readingLabel(post.readingMinutes)
  if (!date && !reading) return null
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 text-xs ${light ? 'text-white/80' : 'text-muted'} ${className}`}
    >
      {date ? <time dateTime={post.publishedAt ?? undefined}>{date}</time> : null}
      {date && reading ? <span aria-hidden="true">·</span> : null}
      {reading ? <span>{reading}</span> : null}
    </p>
  )
}

function Kicker({ name, pill }: { name: string | null; pill?: boolean }) {
  if (!name) return null
  return pill ? (
    <span className="inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm">
      {name}
    </span>
  ) : (
    <span className="block text-xs font-semibold tracking-wide text-brand">{name}</span>
  )
}

const TITLE_HOVER = 'transition-colors group-hover:text-brand'
/** Every card: surface, hairline ring and soft shadow; lifts with a deeper shadow on hover/focus. */
export const CARD =
  'rounded-card bg-card shadow-card ring-1 ring-line/70 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lift hover:ring-brand/25 focus-visible:-translate-y-1 focus-visible:shadow-lift motion-reduce:transform-none motion-reduce:transition-none'

/** One card, seven layouts: hero overlay, lead, horizontal feature, grid, list row, hero side row, ranked compact. */
export function PostCard({
  post,
  variant,
  priority,
  headingLevel: H = 'h3',
  index,
  hideCategory,
  compactOnMobile,
}: PostCardProps) {
  const href = postHref(post.postNumber) ?? '#'
  const cat = hideCategory ? null : categoryName(post)
  const img = { ...post, categoryName: categoryName(post) }

  if (variant === 'hero') {
    return (
      <Link
        href={href}
        className="group relative block aspect-[4/5] overflow-hidden rounded-card bg-brand-deep shadow-card transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lift focus-visible:-translate-y-1 motion-reduce:transform-none sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[28rem]"
      >
        <PostImage
          post={img}
          size="large"
          sizes="(min-width: 1280px) 780px, (min-width: 1024px) 62vw, 100vw"
          priority={priority}
          cover
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:p-7 lg:p-8">
          <Kicker name={cat} pill />
          <H className="line-clamp-4 text-2xl font-bold leading-snug text-white sm:text-3xl lg:text-[2.15rem]">
            {post.title}
          </H>
          {post.excerpt ? (
            <p className="hidden max-w-2xl text-[0.95rem] text-white/85 sm:line-clamp-2">
              {post.excerpt}
            </p>
          ) : null}
          <CardMeta post={post} light />
        </div>
      </Link>
    )
  }

  if (variant === 'side' || variant === 'list') {
    const side = variant === 'side'
    return (
      <Link href={href} className={`group flex items-start gap-3.5 p-3 sm:gap-4 ${CARD}`}>
        <PostImage
          post={img}
          size="thumb"
          sizes="160px"
          className={`aspect-[4/3] shrink-0 rounded-xl ${side ? 'w-24 sm:w-32' : 'w-24 sm:w-28'}`}
        />
        <div className="min-w-0 space-y-1.5">
          <Kicker name={cat} />
          <H
            className={`line-clamp-3 font-display font-semibold leading-snug text-ink ${TITLE_HOVER} ${side ? 'text-base' : 'text-[0.97rem]'}`}
          >
            {post.title}
          </H>
          <CardMeta post={post} />
        </div>
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
            className="w-9 shrink-0 font-display text-3xl font-bold leading-none text-brand/25 tabular-nums"
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
        className={`group grid overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] ${CARD}`}
      >
        <PostImage
          post={img}
          size="large"
          sizes="(min-width: 1024px) 800px, 100vw"
          priority={priority}
          className="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-72"
        />
        <div className="space-y-3 self-center p-5 sm:p-7">
          <Kicker name={cat} />
          <H
            className={`text-2xl font-bold leading-snug text-ink sm:text-[1.75rem] ${TITLE_HOVER}`}
          >
            {post.title}
          </H>
          {post.excerpt ? (
            <p className="line-clamp-4 text-[0.97rem] text-body">{post.excerpt}</p>
          ) : null}
          <CardMeta post={post} />
        </div>
      </Link>
    )
  }

  const lead = variant === 'lead'
  const row = compactOnMobile && !lead
  return (
    <Link
      href={href}
      className={`group flex h-full overflow-hidden ${CARD} ${row ? 'items-start gap-4 p-3 sm:flex-col sm:gap-0 sm:p-0' : 'flex-col'}`}
    >
      <PostImage
        post={img}
        size="card"
        sizes={
          lead
            ? '(min-width: 1024px) 640px, 100vw'
            : `(min-width: 1024px) 400px, (min-width: 640px) 50vw, ${row ? '128px' : '100vw'}`
        }
        priority={priority}
        className={
          row
            ? 'aspect-[4/3] w-28 shrink-0 rounded-xl sm:aspect-[16/10] sm:w-full sm:rounded-none'
            : 'aspect-[16/10]'
        }
      />
      <div className={`min-w-0 flex-1 space-y-2 ${row ? 'sm:p-5' : 'p-4 sm:p-5'}`}>
        <Kicker name={cat} />
        <H
          className={`line-clamp-3 font-bold leading-snug text-ink ${TITLE_HOVER} ${lead ? 'text-xl sm:text-[1.6rem]' : row ? 'text-[0.97rem] sm:text-[1.05rem]' : 'text-[1.05rem]'}`}
        >
          {post.title}
        </H>
        {lead && post.excerpt ? (
          <p className="line-clamp-3 text-[0.97rem] text-body">{post.excerpt}</p>
        ) : null}
        <CardMeta post={post} />
      </div>
    </Link>
  )
}
