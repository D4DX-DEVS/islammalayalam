import { Headphones } from 'lucide-react'
import { categoryName } from '@/components/cards/PostCard'
import { PostImage } from '@/components/cards/PostImage'
import { AudioPlayer, type PlayerTrack } from '@/components/home/AudioPlayer'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { audioSource } from '@/lib/audio'
import { postHref } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import type { PostCardData } from '@/features/posts/queries'

const HeadphonesBadge = (
  <span
    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-brand-deep"
    aria-hidden="true"
  >
    <Headphones className="size-4" />
  </span>
)

/**
 * The Audios shelf as a Spotify-style player. Builds the track list on the server (artwork is
 * rendered here, so the images keep their lazy loading and fallbacks) and hands it to the client player.
 */
export function AudioShelf({
  docs,
  title,
  more,
  half,
}: {
  docs: PostCardData[]
  title: string
  more: string | null
  half: boolean
}) {
  const tracks: PlayerTrack[] = docs.map((post) => {
    const source = audioSource(post.audio?.url)
    const media =
      post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null
    const img = { ...post, categoryName: categoryName(post) }
    return {
      id: post.id,
      title: post.title,
      subtitle: categoryName(post),
      href: postHref(post.postNumber) ?? '#',
      kind: source.kind === 'file' || source.kind === 'spotify' ? source.kind : 'page',
      src: source.kind === 'file' || source.kind === 'spotify' ? source.src : null,
      tallEmbed: source.kind === 'spotify' ? source.tall : false,
      duration: post.audio?.duration ?? null,
      art: mediaSrc(media?.sizes?.card?.url ?? media?.url),
      cover: (
        <PostImage
          post={img}
          size="card"
          sizes="(min-width: 1024px) 272px, 45vw"
          className="size-full"
        />
      ),
      thumb: <PostImage post={img} size="thumb" sizes="44px" className="size-full" />,
    }
  })

  return (
    <section className="relative isolate h-full overflow-hidden rounded-card bg-[linear-gradient(180deg,#15408a_0%,#0c1f45_40%,#08101f_100%)] px-5 py-6 text-white shadow-card ring-1 ring-white/10 sm:px-7 sm:py-8">
      <SectionHeading title={title} href={more} tone="dark" icon={HeadphonesBadge} />
      <AudioPlayer tracks={tracks} half={half} label={title} />
    </section>
  )
}
