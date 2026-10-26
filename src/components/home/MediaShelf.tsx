import { BookOpen, CirclePlay } from 'lucide-react'
import { BookCard, VideoCard } from '@/components/cards/MediaCards'
import { AudioShelf } from '@/components/home/AudioShelf'
import { BannerAds } from '@/components/home/BannerAds'
import { ScrollRow } from '@/components/ui/ScrollRow'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listAudioEntries, listVideoEntries, type MediaEntry } from '@/features/media-items/queries'
import { getShowFeed } from '@/features/spotify/queries'
import { getAds } from '@/features/site/queries'
import { listPosts, type PostCardData } from '@/features/posts/queries'
import { displayTitle, mergeFirst } from '@/lib/media-items'
import { spotifyShowId, type Episode, type Show } from '@/lib/spotify-show'
import { youtubeId } from '@/lib/security/url'
import { youtubeDetails, youtubeStatus, type VideoStatus } from '@/lib/youtube'
import { categoryHref } from '@/lib/links'
import type { Category, MediaShelfBlock } from '@/payload-types'

type VideoTile = {
  key: string
  post: PostCardData
  status: VideoStatus
  /** The post page; null for a quick entry (it has none). */
  href: string | null | undefined
  author: string | null
}

/** A quick video entry as a card: the YouTube thumbnail comes from the video id, like a Video post's. */
const entryPost = (id: string, title: string, videoId: string): PostCardData =>
  ({
    id,
    title,
    excerpt: null,
    featuredImage: null,
    postNumber: null,
    publishedAt: null,
    format: 'video',
    primaryCategory: null,
    video: {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      youtubeId: videoId,
      duration: null,
    },
    audio: null,
    author: null,
  }) as unknown as PostCardData

/** Every episode of the show is listed in the Audios card (Spotify's API gives 50 at most). */
const MAX_EPISODES = 50

const FORMAT_TITLE = { video: 'Videos', audio: 'Audios', ebook: 'E-Books' } as const

/**
 * Videos → royal-blue band with a swipeable carousel (edge to edge when it has its own row, a
 * rounded panel when it shares one); E-Books → cover shelf; Audios → listen list.
 * `bleed` = the caller renders this row outside the page container, so the band spans the screen.
 */
export async function MediaShelf({
  block,
  half,
  bleed = false,
}: {
  block: MediaShelfBlock
  half: boolean
  bleed?: boolean
}) {
  const category =
    block.category && typeof block.category === 'object' ? (block.category as Category) : null
  const { docs } = await listPosts({
    format: block.format,
    categoryId: category?.id,
    limit: block.limit,
  })
  // Quick entries added in the admin (link / title / author) always come first in the Audios and
  // Videos sections — they have no category, so a section limited to one still shows them.
  const entries: MediaEntry[] =
    block.format === 'ebook'
      ? []
      : block.format === 'video'
        ? await listVideoEntries(block.limit)
        : await listAudioEntries(block.limit)
  // The episodes of the Spotify show set on an Audios section come straight from Spotify, so a
  // new episode appears here by itself.
  const feed: { show: Show | null; episodes: Episode[] } =
    block.format === 'audio'
      ? await getShowFeed(block.spotifyUrl, MAX_EPISODES)
      : { show: null, episodes: [] }
  const { episodes } = feed
  const showMore = spotifyShowId(block.spotifyUrl)
    ? { href: '/audios/', external: false }
    : { href: null, external: false }
  if (!docs.length && !entries.length && !episodes.length) return null
  const title = block.title || category?.name || FORMAT_TITLE[block.format]
  const more = category ? categoryHref(category.slug) : null

  if (block.format === 'video') {
    // Ask YouTube (cached for hours) which videos still play, so the popup can say so for the ones that do not.
    // Entries come first (in the admin's order), then the Video posts.
    const entryTiles: VideoTile[] = await Promise.all(
      entries.map(async (entry) => {
        const videoId = youtubeId(entry.link) ?? ''
        const details = await youtubeDetails(videoId)
        return {
          key: `entry-${entry.id}`,
          post: entryPost(entry.id, displayTitle(entry, 'video', details.title), videoId),
          status: details.status,
          href: null,
          author: entry.author || details.author,
        }
      }),
    )
    const postDocs = docs.slice(0, Math.max(0, block.limit - entryTiles.length))
    const postTiles: VideoTile[] = await Promise.all(
      postDocs.map(async (post) => ({
        key: post.id,
        post,
        status: post.video?.youtubeId ? await youtubeStatus(post.video.youtubeId) : 'unknown',
        href: undefined,
        author: null,
      })),
    )
    const tiles = mergeFirst(entryTiles, postTiles, block.limit)
    const items = (
      <>
        <SectionHeading title={title} href={more} tone="dark" icon={CirclePlay} />
        <ScrollRow
          tone="dark"
          arrows="beside"
          label={title}
          listClassName="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {tiles.map((tile) => (
            <li
              key={tile.key}
              data-reveal="up"
              suppressHydrationWarning
              className={`w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] ${half ? '' : 'lg:w-[calc((100%-3rem)/4)]'}`}
            >
              <VideoCard
                post={tile.post}
                status={tile.status}
                href={tile.href}
                author={tile.author}
              />
            </li>
          ))}
        </ScrollRow>
      </>
    )
    return (
      <section
        className={`bg-night relative isolate overflow-hidden ring-1 ring-white/10 ${bleed ? 'py-8 sm:py-10' : 'h-full rounded-card px-5 py-7 sm:px-8 sm:py-9'}`}
      >
        {bleed ? <Container>{items}</Container> : items}
      </section>
    )
  }

  if (block.format === 'ebook') {
    // The column is as tall as its neighbour in the row (the Audios player): the shelf takes all the
    // height the banner ads leave, and its cards grow to fill it. On a phone, where the sections
    // stack, the cards keep a sensible height of their own.
    const { bottom } = await getAds()
    return (
      <div className="flex h-full flex-col gap-6">
        <section className="flex flex-1 flex-col rounded-card bg-card px-4 py-4 shadow-card ring-1 ring-line/60 sm:px-6 sm:py-5">
          <SectionHeading title={title} href={more} icon={BookOpen} className="!mb-3 sm:!mb-4" />
          {/* Three books at a time; the row scrolls (arrows, swipe) when there are more. */}
          <ScrollRow tone="light" arrows="overlay" label={title} fill listClassName="pb-1">
            {docs.map((post) => (
              <li
                key={post.id}
                className={`w-[42%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] ${half ? '' : 'lg:w-[calc((100%-5rem)/6)]'}`}
              >
                <BookCard post={post} />
              </li>
            ))}
          </ScrollRow>
        </section>
        <BannerAds ads={bottom} />
      </div>
    )
  }

  return (
    <AudioShelf
      docs={docs}
      entries={entries}
      episodes={episodes}
      show={feed.show}
      limit={block.limit}
      title={title}
      // With a Spotify show behind the section, "View More" opens every episode: on this site's
      // /audios/ page, which links on to the show on Spotify.
      more={showMore.href ?? more}
      moreExternal={showMore.external}
      half={half}
    />
  )
}
