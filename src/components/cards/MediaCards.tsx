import Link from 'next/link'
import { Play } from 'lucide-react'
import { PostImage } from '@/components/cards/PostImage'
import { categoryName } from '@/components/cards/PostCard'
import { postHref } from '@/lib/links'
import type { PostCardData } from '@/features/posts/queries'

interface MediaCardProps {
  post: PostCardData
  headingLevel?: 'h2' | 'h3'
}

/** Video tile for the royal-blue band: 16:9 thumbnail, ringed play button, title over the picture. */
export function VideoCard({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      className="group relative block aspect-video overflow-hidden rounded-xl bg-brand-deep shadow-lift ring-1 ring-white/15 transition duration-300 ease-out hover:-translate-y-1 hover:ring-accent/80 focus-visible:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <PostImage
        post={{ ...post, categoryName: categoryName(post) }}
        size="card"
        sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 80vw"
        cover
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
      <span className="absolute left-1/2 top-[42%] inline-flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white ring-2 ring-white/75 backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:bg-white group-hover:text-brand-deep">
        <span
          className="absolute inset-0 rounded-full ring-2 ring-white/70 opacity-0 group-hover:animate-ping-soft"
          aria-hidden="true"
        />
        <Play className="ms-0.5 size-6 fill-current" aria-hidden="true" />
      </span>
      <H
        className={`absolute inset-x-0 bottom-0 line-clamp-2 p-3.5 text-[0.97rem] font-bold leading-snug text-white ${post.video?.duration ? 'pe-20' : ''}`}
      >
        {post.title}
      </H>
      {post.video?.duration ? (
        <span className="absolute bottom-3 end-3 rounded-md bg-black/55 px-2 py-0.5 text-xs font-bold tabular-nums text-white ring-1 ring-accent/80 backdrop-blur-sm">
          {post.video.duration}
        </span>
      ) : null}
    </Link>
  )
}

/**
 * E-book: the whole cover (never cropped) on a soft tile with a spine shadow, and the title
 * underneath. A book with no cover image gets the site placeholder.
 */
export function BookCard({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      data-reveal="up"
      className="group flex h-full flex-col gap-3 outline-offset-4"
    >
      <div className="relative overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-line/70 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lift group-focus-visible:-translate-y-1 motion-reduce:transform-none">
        <PostImage
          post={post}
          size="card"
          sizes="(min-width: 1024px) 220px, 42vw"
          className="aspect-square"
          fit="contain"
        />
        <span
          className="pointer-events-none absolute inset-y-0 start-0 w-2.5 bg-gradient-to-r from-black/25 to-transparent"
          aria-hidden="true"
        />
      </div>
      <H className="line-clamp-2 text-center text-[0.9rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
        {post.title}
      </H>
    </Link>
  )
}

/** Audio row: round play button, title, and a little equalizer that dances on hover. */
export function AudioRow({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      data-reveal="left"
      className="group flex items-center gap-4 px-1 py-3 transition-colors hover:bg-brand-soft/60 sm:px-2"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-card transition duration-300 group-hover:scale-110 group-hover:bg-brand-strong">
        <Play className="ms-0.5 size-4 fill-current" aria-hidden="true" />
      </span>
      <H className="line-clamp-2 min-w-0 flex-1 text-[0.97rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
        {post.title}
      </H>
      <span
        className="flex h-4 shrink-0 items-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      >
        {[0, 0.25, 0.5].map((delay) => (
          <span
            key={delay}
            className="h-full w-[3px] origin-bottom rounded-full bg-brand motion-safe:animate-eq"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
    </Link>
  )
}
