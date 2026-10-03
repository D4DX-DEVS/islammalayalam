import Image from 'next/image'
import { BookOpen, FileText, Headphones, CirclePlay } from 'lucide-react'
import { mediaSrc } from '@/lib/media'
import type { Media, Post } from '@/payload-types'

type SizeName = 'thumb' | 'card' | 'medium' | 'large'
type PostLike = Pick<Post, 'featuredImage' | 'format' | 'video'> & {
  categoryName?: string | null
  title?: string | null
}

interface PostImageProps {
  post: PostLike
  size: SizeName
  sizes: string
  priority?: boolean
  className?: string
  /** Fill the nearest positioned ancestor (overlay cards) instead of sizing by aspect ratio. */
  cover?: boolean
  /** Fallback artwork shows the title (book covers). */
  titleOnFallback?: boolean
}

const FORMAT_ICON = {
  video: CirclePlay,
  audio: Headphones,
  ebook: BookOpen,
  standard: FileText,
} as const
// Brand-blue family: the designed fallback varies by format, never by random colours.
const FALLBACK_TONE = {
  standard: 'from-[#1a6bc4] to-[#0b2447]',
  video: 'from-[#0f3d7a] to-[#06142b]',
  audio: 'from-[#1d5fa8] to-[#123a6b]',
  ebook: 'from-[#13549e] to-[#0b2447]',
} as const

function pickSource(
  media: Media,
  size: SizeName,
): { url: string; width: number; height: number } | null {
  const order: SizeName[] =
    size === 'thumb'
      ? ['thumb', 'card']
      : size === 'card'
        ? ['card', 'medium']
        : [size, 'large', 'medium', 'card']
  for (const name of order) {
    const s = media.sizes?.[name]
    const url = mediaSrc(s?.url)
    if (url && s?.width && s.height) return { url, width: s.width, height: s.height }
  }
  const url = mediaSrc(media.url)
  return url && media.width && media.height
    ? { url, width: media.width, height: media.height }
    : null
}

/**
 * Featured image with two fallbacks: the YouTube thumbnail for video posts, then designed artwork
 * (brand gradient + star lattice + format icon). Never an empty grey box (audit §4).
 */
export function PostImage({
  post,
  size,
  sizes,
  priority,
  className = '',
  cover,
  titleOnFallback,
}: PostImageProps) {
  const media =
    post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null
  const src = media ? pickSource(media, size) : null
  const frame = `${cover ? 'absolute inset-0' : 'relative'} isolate overflow-hidden bg-surface ${className}`

  if (media && src) {
    return (
      <div className={frame}>
        <Image
          src={src.url}
          alt={media.alt ?? ''}
          fill
          sizes={sizes}
          // Not `preload`: several cards above the fold differ by screen size, so a preload tag would
          // fetch images that never show (Next image docs). Eager + high priority loads them early.
          loading={priority ? 'eager' : undefined}
          fetchPriority={priority ? 'high' : undefined}
          placeholder={media.blurDataURL ? 'blur' : 'empty'}
          blurDataURL={media.blurDataURL ?? undefined}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
    )
  }

  const ytId = post.format === 'video' ? post.video?.youtubeId : null
  if (ytId) {
    return (
      <div className={frame}>
        <Image
          src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
    )
  }

  const format = post.format ?? 'standard'
  const Icon = FORMAT_ICON[format] ?? FileText
  return (
    <div
      className={`${frame} bg-gradient-to-br ${FALLBACK_TONE[format] ?? FALLBACK_TONE.standard} text-white`}
      aria-hidden="true"
    >
      <div className="bg-star-lattice absolute inset-0 opacity-[0.14]" />
      {titleOnFallback && post.title ? (
        <div className="relative flex h-full flex-col justify-between p-3 sm:p-4">
          <Icon className="size-5 opacity-80" />
          <span className="line-clamp-4 font-display text-sm font-bold leading-snug sm:text-base">
            {post.title}
          </span>
        </div>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
            <Icon className="size-6" />
          </span>
          {post.categoryName ? (
            <span className="text-xs font-semibold tracking-wide text-white/90">
              {post.categoryName}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
