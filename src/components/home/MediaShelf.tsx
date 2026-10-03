import { AudioRow, BookCard, VideoCard } from '@/components/cards/MediaCards'
import { PANEL } from '@/components/home/CategorySections'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listPosts } from '@/features/posts/queries'
import { categoryHref } from '@/lib/links'
import type { Category, MediaShelfBlock } from '@/payload-types'

const FORMAT_TITLE = { video: 'Videos', audio: 'Audios', ebook: 'E-Books' } as const

/**
 * Videos → navy band with play tiles (swipe row on phones); E-Books → cover shelf; Audios → listen list.
 * Half-width shelves (two side by side on desktop) keep their own panel.
 */
export async function MediaShelf({ block, half }: { block: MediaShelfBlock; half: boolean }) {
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
    return (
      <section className="relative isolate h-full overflow-hidden rounded-[1.75rem] bg-brand-deep px-5 py-7 sm:px-8 sm:py-9">
        <div
          className="bg-star-lattice pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -end-24 -top-24 -z-10 size-72 rounded-full bg-sky-400/20 blur-3xl"
          aria-hidden="true"
        />
        <SectionHeading title={title} href={more} tone="dark" />
        <ul
          className={`no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:pb-0 sm:grid sm:overflow-visible sm:px-0 ${half ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}
        >
          {docs.map((post) => (
            <li key={post.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <VideoCard post={post} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (block.format === 'ebook') {
    return (
      <section className={PANEL}>
        <SectionHeading title={title} href={more} />
        <ul
          className={`grid grid-cols-2 gap-x-5 gap-y-7 ${half ? 'sm:grid-cols-3' : 'sm:grid-cols-4 lg:grid-cols-6'}`}
        >
          {docs.map((post) => (
            <li key={post.id}>
              <BookCard post={post} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className={PANEL}>
      <SectionHeading title={title} href={more} />
      <ul className={`grid grid-cols-1 gap-3 ${half ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {docs.map((post) => (
          <li key={post.id}>
            <AudioRow post={post} />
          </li>
        ))}
      </ul>
    </section>
  )
}
