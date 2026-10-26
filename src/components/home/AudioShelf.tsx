import Image from 'next/image'
import { Headphones } from 'lucide-react'
import { categoryName } from '@/components/cards/PostCard'
import { PostImage } from '@/components/cards/PostImage'
import { AudioPlayer, type PlayerTrack } from '@/components/home/AudioPlayer'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { trackAudio } from '@/lib/audio'
import { formatDate } from '@/lib/format'
import { displayTitle, mergeFirst } from '@/lib/media-items'
import { postHref } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import { spotifyTitle } from '@/lib/spotify'
import { getEpisode } from '@/features/spotify/queries'
import { clock, minutes, spotifyEpisodeId, type Episode, type Show } from '@/lib/spotify-show'
import type { MediaEntry } from '@/features/media-items/queries'
import type { PostCardData } from '@/features/posts/queries'

/** An episode's own picture (Spotify's cover art, through the image optimizer), or the audio placeholder. */
const episodeCover = (src: string | null, title: string) =>
  src ? (
    <span className="relative block size-full overflow-hidden">
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 640px) 144px, 96px"
        className="object-cover"
      />
    </span>
  ) : (
    <PostImage
      post={{ featuredImage: null, format: 'audio', title } as never}
      size="card"
      sizes="(min-width: 640px) 144px, 96px"
      className="size-full"
    />
  )

/** How many of a Spotify show's episodes the card lists (Spotify's API gives at most 50 at a time). */
const MAX_LISTED = 50

/**
 * The Audios section as a podcast-style player. Builds the episode list on the server (artwork is
 * rendered here, so the images keep their lazy loading and fallbacks) and hands it to the client
 * player. The quick entries added in the admin (link / title / author) come first, in the order set in the admin,
 * then the Audio posts; when there are entries, posts with no audio of their own are left out.
 */
export async function AudioShelf({
  docs,
  entries = [],
  episodes = [],
  show = null,
  limit,
  title,
  more,
  moreExternal = false,
  moreLabel,
  fullList = false,
  half,
}: {
  docs: PostCardData[]
  entries?: MediaEntry[]
  /** The newest episodes of the Spotify show set on the section; they come first. */
  episodes?: Episode[]
  /** The Spotify show behind the episodes: its name is shown under the episode that plays. */
  show?: Show | null
  limit: number
  title: string
  more: string | null
  /** "View More" leaves the site (the show on Spotify). */
  moreExternal?: boolean
  /** The link's wording, when it is not "View More". */
  moreLabel?: string
  /** Its own page: the card is as tall as the screen allows. */
  fullList?: boolean
  half: boolean
}) {
  const episodeTracks: PlayerTrack[] = episodes.map((episode) => {
    const { source, spotifyLink } = trackAudio({ url: episode.url, spotifyUrl: episode.url })
    return {
      id: `spotify-${episode.id}`,
      title: episode.title,
      subtitle: formatDate(episode.date),
      href: null,
      kind: source.kind === 'none' ? 'none' : source.kind,
      src: source.kind === 'none' ? null : source.src,
      tallEmbed: source.kind === 'spotify' ? source.tall : false,
      duration: clock(episode.durationSec),
      description: episode.description || null,
      length: minutes(episode.durationSec),
      art: episode.image,
      cover: episodeCover(episode.image, episode.title),
      spotifyLink,
    } satisfies PlayerTrack
  })
  // An entry an editor added by hand for an episode the show already lists would show twice.
  const listed = new Set(episodes.map((e) => e.id))
  const entryTracks: PlayerTrack[] = await Promise.all(
    entries
      .filter((entry) => !listed.has(spotifyEpisodeId(entry.link) ?? ''))
      .map(async (entry) => {
        const { source, spotifyLink } = trackAudio({ url: entry.link, spotifyUrl: entry.link })
        // A Spotify episode link: ask Spotify for its picture, date and length (and name, if none
        // was typed); other Spotify links only for their name.
        const info = source.kind === 'spotify' ? await getEpisode(entry.link) : null
        const reported =
          !entry.title && !info && source.kind === 'spotify' ? await spotifyTitle(entry.link) : null
        const name = displayTitle(entry, 'audio', info?.title ?? reported)
        return {
          id: `entry-${entry.id}`,
          title: name,
          subtitle: info?.date ? formatDate(info.date) : entry.author || null,
          href: null,
          kind: source.kind === 'none' ? 'none' : source.kind,
          src: source.kind === 'none' ? null : source.src,
          tallEmbed: source.kind === 'spotify' ? source.tall : false,
          duration: info ? clock(info.durationSec) : null,
          description: info ? entry.author || null : null,
          length: info ? minutes(info.durationSec) : null,
          art: info?.image ?? null,
          cover: episodeCover(info?.image ?? null, name),
          spotifyLink,
        } satisfies PlayerTrack
      }),
  )

  const playable =
    entries.length || episodes.length
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
      description: null,
      length: null,
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
  // A Spotify show's episodes are all listed (the card scrolls); otherwise the section's own limit.
  const shown = episodes.length ? Math.max(limit, MAX_LISTED) : limit
  const tracks = mergeFirst([...episodeTracks, ...entryTracks], postTracks, shown)
  if (!tracks.length) return null

  // The card is the same size however many episodes there are and whatever is playing: the list
  // scrolls inside it. Beside another section (half) it is as tall as that section's column, never
  // shorter than CARD_MIN, and its content is taken out of the flow, so it cannot stretch the row.
  // On its own page, below `lg`, the card grows with its list and the page itself scrolls: a list
  // scrolling inside a screen-high card fights the page's scroll on a phone.
  const size = fullList
    ? 'mx-auto max-w-4xl lg:h-[min(52rem,calc(100dvh-9rem))] lg:min-h-[30rem]'
    : half
      ? 'h-[40rem] lg:h-auto lg:min-h-[36rem]'
      : 'mx-auto h-[40rem] max-w-4xl sm:h-[36rem]'
  return (
    <section
      className={`relative isolate overflow-hidden rounded-card bg-card shadow-card ring-1 ring-line/60 ${size}`}
    >
      <div className={half && !fullList ? 'h-full lg:absolute lg:inset-0' : 'h-full'}>
        <AudioPlayer
          show={show ? { name: show.name, url: show.url } : null}
          tracks={tracks}
          label={title}
          heading={
            <SectionHeading
              title={title}
              href={more}
              external={moreExternal}
              moreLabel={moreLabel}
              tone="default"
              icon={Headphones}
              className="!mb-0"
            />
          }
        />
      </div>
    </section>
  )
}
