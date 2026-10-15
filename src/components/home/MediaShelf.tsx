import { Play } from 'lucide-react'
import { BookCard, VideoCard } from '@/components/cards/MediaCards'
import { AudioShelf } from '@/components/home/AudioShelf'
import { PANEL } from '@/components/home/CategorySections'
import { ScrollRow } from '@/components/ui/ScrollRow'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listPosts } from '@/features/posts/queries'
import { categoryHref } from '@/lib/links'
import type { Category, MediaShelfBlock } from '@/payload-types'

const FORMAT_TITLE = { video: 'Videos', audio: 'Audios', ebook: 'E-Books' } as const

/** Gold play badge that replaces the gold bar in the video band's heading. */
const PlayBadge = (
  <span
    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-brand-deep"
    aria-hidden="true"
  >
    <Play className="ms-0.5 size-4 fill-current" />
  </span>
)

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
  if (!docs.length) return null
  const title = block.title || category?.name || FORMAT_TITLE[block.format]
  const more = category ? categoryHref(category.slug) : null

  if (block.format === 'video') {
    const items = (
      <>
        <SectionHeading title={title} href={more} tone="dark" icon={PlayBadge} />
        <ScrollRow
          tone="dark"
          arrows="beside"
          label={title}
          listClassName="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {docs.map((post) => (
            <li
              key={post.id}
              data-reveal="up"
              className={`w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] ${half ? '' : 'lg:w-[calc((100%-3rem)/4)]'}`}
            >
              <VideoCard post={post} />
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
    return (
      <section className={`${PANEL} flex flex-col`}>
        <SectionHeading title={title} href={more} />
        {/* Three books at a time; the row scrolls (arrows, swipe) when there are more. */}
        <div className="flex flex-1 flex-col justify-center">
          <ScrollRow tone="light" arrows="overlay" label={title} listClassName="pb-1">
            {docs.map((post) => (
              <li
                key={post.id}
                className={`w-[42%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] ${half ? '' : 'lg:w-[calc((100%-5rem)/6)]'}`}
              >
                <BookCard post={post} />
              </li>
            ))}
          </ScrollRow>
        </div>
      </section>
    )
  }

  return <AudioShelf docs={docs} title={title} more={more} half={half} />
}
