import Link from 'next/link'
import { Play } from 'lucide-react'
import { PostImage } from '@/components/cards/PostImage'
import { categoryName } from '@/components/cards/PostCard'
import { VideoLightbox } from '@/components/cards/VideoLightbox'
import { postHref } from '@/lib/links'
import type { PostCardData } from '@/features/posts/queries'

interface MediaCardProps {
  post: PostCardData
  headingLevel?: 'h2' | 'h3'
  /** Video tiles: what YouTube says about the video (see lib/youtube.ts). */
  status?: 'ok' | 'external' | 'gone' | 'unknown'
  /** Video tiles: the post page (default: this post's own); null for a quick entry with no page. */
  href?: string | null
  /** Video tiles: who it is by, shown under the title. */
  author?: string | null
}

/** Video tile for the royal-blue band: 16:9 thumbnail, ringed play button, title over the picture. */
export function VideoCard({ post, headingLevel: H = 'h3', status, href, author }: MediaCardProps) {
  return (
    <VideoLightbox
      videoId={post.video?.youtubeId}
      title={post.title}
      author={author}
      href={href === undefined ? (postHref(post.postNumber) ?? '#') : href}
      status={status}
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
      <div className={`absolute inset-x-0 bottom-0 p-3.5 ${post.video?.duration ? 'pe-20' : ''}`}>
        <H className="line-clamp-2 text-[0.97rem] font-bold leading-snug text-white">
          {post.title}
        </H>
        {author ? (
          <p className="mt-0.5 truncate text-xs font-medium text-white/80">{author}</p>
        ) : null}
      </div>
      {post.video?.duration ? (
        <span className="absolute bottom-3 end-3 rounded-md bg-black/55 px-2 py-0.5 text-xs font-bold tabular-nums text-white ring-1 ring-accent/80 backdrop-blur-sm">
          {post.video.duration}
        </span>
      ) : null}
    </VideoLightbox>
  )
}

/**
 * E-book: a tall card. The whole cover is shown (never cropped) in front of a soft, blurred copy of
 * itself that fills the rest of the tile, with the title underneath. The card grows to the height
 * its shelf gives it. A book with no cover image gets the site placeholder.
 */
export function BookCard({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      data-reveal="up"
      suppressHydrationWarning
      className="group flex h-full min-h-[18rem] flex-col gap-3 outline-offset-4"
    >
      <div className="relative min-h-52 flex-1 overflow-hidden rounded-lg bg-brand-deep shadow-card ring-1 ring-line/70 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lift group-focus-visible:-translate-y-1 motion-reduce:transform-none">
        {/* Backdrop: the same cover, enlarged and blurred, so a tall tile is never left with empty bands. */}
        <div className="absolute inset-0 scale-125 blur-2xl saturate-150" aria-hidden="true">
          <PostImage post={post} size="thumb" sizes="64px" cover className="!bg-transparent" />
        </div>
        <div className="absolute inset-0 bg-black/15" aria-hidden="true" />
        <PostImage
          post={post}
          size="card"
          sizes="(min-width: 1024px) 220px, 42vw"
          cover
          fit="contain"
          className="!bg-transparent p-1.5"
        />
        <span
          className="pointer-events-none absolute inset-y-0 start-0 z-[3] w-2.5 bg-gradient-to-r from-black/25 to-transparent"
          aria-hidden="true"
        />
      </div>
      <H className="line-clamp-2 min-h-[2.6em] text-center text-[0.9rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
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
      suppressHydrationWarning
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
