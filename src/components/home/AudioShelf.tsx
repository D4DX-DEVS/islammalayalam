import { Headphones } from 'lucide-react'
import { categoryName } from '@/components/cards/PostCard'
import { PostImage } from '@/components/cards/PostImage'
import { AudioPlayer, type PlayerTrack } from '@/components/home/AudioPlayer'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { trackAudio } from '@/lib/audio'
import { displayTitle, mergeFirst } from '@/lib/media-items'
import { postHref } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import { spotifyOpenUrl } from '@/lib/security/url'
import { spotifyTitle } from '@/lib/spotify'
import type { MediaEntry } from '@/features/media-items/queries'
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
 * The Audios section as a podcast-style player. Builds the episode list on the server (artwork is
 * rendered here, so the images keep their lazy loading and fallbacks) and hands it to the client
 * player. The quick entries added in the admin (link / title / author) come first, newest first,
 * then the Audio posts; when there are entries, posts with no audio of their own are left out.
 * `spotifyUrl` is the show/playlist link the editor set on the section.
 */
export async function AudioShelf({
  docs,
  entries = [],
  limit,
  title,
  more,
  half,
  spotifyUrl,
}: {
  docs: PostCardData[]
  entries?: MediaEntry[]
  limit: number
  title: string
  more: string | null
  half: boolean
  spotifyUrl?: string | null
}) {
  const entryTracks: PlayerTrack[] = await Promise.all(
    entries.map(async (entry) => {
      const { source, spotifyLink } = trackAudio({ url: entry.link, spotifyUrl: entry.link })
      // No title typed: ask Spotify what the episode is called.
      const reported =
        !entry.title && source.kind === 'spotify' ? await spotifyTitle(entry.link) : null
      const name = displayTitle(entry, 'audio', reported)
      return {
        id: `entry-${entry.id}`,
        title: name,
        subtitle: entry.author || null,
        href: null,
        kind: source.kind === 'none' ? 'none' : source.kind,
        src: source.kind === 'none' ? null : source.src,
        tallEmbed: source.kind === 'spotify' ? source.tall : false,
        duration: null,
        art: null,
        cover: (
          <PostImage
            post={{ featuredImage: null, format: 'audio', title: name } as never}
            size="card"
            sizes="(min-width: 640px) 144px, 96px"
            className="size-full"
          />
        ),
        spotifyLink,
      } satisfies PlayerTrack
    }),
  )

  const playable = entries.length
    ? docs.filter((post) => trackAudio(post.audio).source.kind !== 'none')
    : docs
  const postTracks: PlayerTrack[] = playable.map((post) => {
    const { source, spotifyLink } = trackAudio(post.audio)
    const media =
      post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null
    const kind = source.kind === 'none' ? 'none' : source.kind
    return {
      id: post.id,
      title: post.title,
      subtitle: categoryName(post),
      href: postHref(post.postNumber) ?? '#',
      kind,
      src: source.kind === 'none' ? null : source.src,
      tallEmbed: source.kind === 'spotify' ? source.tall : false,
      duration: post.audio?.duration ?? null,
      art: mediaSrc(media?.sizes?.card?.url ?? media?.url),
      cover: (
        <PostImage
          post={{ ...post, categoryName: categoryName(post) }}
          size="card"
          sizes="(min-width: 640px) 144px, 96px"
          className="size-full"
        />
      ),
      spotifyLink,
    }
  })
  const tracks = mergeFirst(entryTracks, postTracks, limit)
  if (!tracks.length) return null

  return (
    <section
      className={`relative isolate overflow-hidden rounded-card bg-[#121212] shadow-card ring-1 ring-white/10 ${half ? 'h-full' : 'mx-auto max-w-4xl'}`}
    >
      <AudioPlayer
        tracks={tracks}
        half={half}
        label={title}
        spotifyUrl={spotifyOpenUrl(spotifyUrl)}
        heading={<SectionHeading title={title} href={more} tone="dark" icon={HeadphonesBadge} />}
      />
    </section>
  )
}
