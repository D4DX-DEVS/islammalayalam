import { BookOpen, FileText, Headphones, CirclePlay } from 'lucide-react'
import { LazyImage } from '@/components/ui/LazyImage'
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
  /** cover = fill and crop (default) · contain = show the whole picture (book covers). */
  fit?: 'cover' | 'contain'
}

/** Shown when a post has no image of its own. */
const PLACEHOLDER = '/brand/post-placeholder.jpg'
const FORMAT_ICON = {
  video: CirclePlay,
  audio: Headphones,
  ebook: BookOpen,
  standard: FileText,
} as const
// Brand-blue family: the designed fallback varies by format, never by random colours.
const FALLBACK_TONE = {
  standard: 'from-[#2f86e6] to-[#0a3f8f]',
  video: 'from-[#1a5cc0] to-[#072a60]',
  audio: 'from-[#2a79d6] to-[#0b3a82]',
  ebook: 'from-[#1f6ccc] to-[#082e6b]',
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

/** True when the post has a picture of its own (an image, or a YouTube thumbnail), not the placeholder. */
export function hasPicture(post: PostLike): boolean {
  const media =
    post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null
  if (media && pickSource(media, 'large')) return true
  return Boolean(post.format === 'video' && post.video?.youtubeId)
}

/**
 * Featured image with two fallbacks: the YouTube thumbnail for video posts, then the site's
 * placeholder image (public/brand/post-placeholder.jpg). Never an empty grey box (audit §4).
 */
export function PostImage({
  post,
  size,
  sizes,
  priority,
  className = '',
  cover,
  titleOnFallback,
  fit = 'cover',
}: PostImageProps) {
  const media =
    post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null
  const src = media ? pickSource(media, size) : null
  const frame = `${cover ? 'absolute inset-0' : 'relative'} shine isolate overflow-hidden bg-surface ${className}`

  if (media && src) {
    return (
      <div className={frame}>
        <LazyImage
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
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        />
      </div>
    )
  }

  const ytId = post.format === 'video' ? post.video?.youtubeId : null
  if (ytId) {
    return (
      <div className={frame}>
        <LazyImage
          src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          className="object-cover"
        />
      </div>
    )
  }

  const format = post.format ?? 'standard'
  // An e-book without a cover: its title on a plain blue cover.
  if (titleOnFallback && post.title) {
    const Icon = FORMAT_ICON[format] ?? FileText
    return (
      <div
        className={`${frame} bg-gradient-to-br ${FALLBACK_TONE[format] ?? FALLBACK_TONE.standard} text-white`}
        aria-hidden="true"
      >
        <div className="relative flex h-full flex-col justify-between p-3 sm:p-4">
          <Icon className="size-5 opacity-80" />
          <span className="line-clamp-4 font-display text-sm font-bold leading-snug sm:text-base">
            {post.title}
          </span>
        </div>
      </div>
    )
  }

  // No picture at all: the site's own placeholder image, so a card never looks empty.
  return (
    <div className={frame} aria-hidden="true">
      <LazyImage
        src={PLACEHOLDER}
        alt=""
        fill
        sizes={sizes}
        loading={priority ? 'eager' : undefined}
        className="object-cover"
      />
    </div>
  )
}
