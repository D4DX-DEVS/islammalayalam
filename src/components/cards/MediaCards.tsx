import Link from 'next/link'
import { Headphones, Play } from 'lucide-react'
import { PostImage } from '@/components/cards/PostImage'
import { CARD, CardMeta, categoryName } from '@/components/cards/PostCard'
import { postHref } from '@/lib/links'
import type { PostCardData } from '@/features/posts/queries'

interface MediaCardProps {
  post: PostCardData
  headingLevel?: 'h2' | 'h3'
}

/** Video tile for the dark video band: 16:9 thumbnail with a play badge, white text. */
export function VideoCard({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      className="group flex h-full flex-col overflow-hidden rounded-card bg-white/[0.06] ring-1 ring-white/10 transition duration-300 ease-out hover:-translate-y-1 hover:bg-white/10 hover:shadow-lift focus-visible:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="relative">
        <PostImage
          post={{ ...post, categoryName: categoryName(post) }}
          size="card"
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 80vw"
          className="aspect-video"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/95 text-brand-deep shadow-lift ring-8 ring-white/20 transition-transform duration-300 group-hover:scale-110">
            <Play className="ms-0.5 size-6 fill-current" aria-hidden="true" />
          </span>
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <H className="line-clamp-2 text-[1.02rem] font-semibold leading-snug text-white transition-colors group-hover:text-sky-200">
          {post.title}
        </H>
        <CardMeta post={post} light />
      </div>
    </Link>
  )
}

/** E-book: portrait cover with a spine shadow; artwork shows the title when there is no cover image. */
export function BookCard({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link href={postHref(post.postNumber) ?? '#'} className="group flex flex-col gap-3">
      <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
        <PostImage
          post={post}
          size="card"
          sizes="(min-width: 1024px) 200px, 40vw"
          className="aspect-[3/4] rounded-e-lg rounded-s-sm shadow-lift"
          titleOnFallback
        />
        <span
          className="pointer-events-none absolute inset-y-0 start-0 w-3 rounded-s-sm bg-gradient-to-r from-black/35 to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <H className="line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
          {post.title}
        </H>
        <CardMeta post={post} />
      </div>
    </Link>
  )
}

/** Audio row: round listen badge + title (the player lives on the article page). */
export function AudioRow({ post, headingLevel: H = 'h3' }: MediaCardProps) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      className={`group flex items-center gap-4 p-3 ${CARD}`}
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-card transition-transform group-hover:scale-105">
        <Headphones className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-1">
        <H className="line-clamp-2 text-[0.97rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
          {post.title}
        </H>
        <CardMeta post={post} />
      </div>
    </Link>
  )
}
