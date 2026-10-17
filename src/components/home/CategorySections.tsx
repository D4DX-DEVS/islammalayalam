import Link from 'next/link'
import { Star } from 'lucide-react'
import { PostCard, CardMeta, categoryName } from '@/components/cards/PostCard'
import { PostImage, hasPicture } from '@/components/cards/PostImage'
import { HeroSlider } from '@/components/home/HeroSlider'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listPosts, type PostCardData } from '@/features/posts/queries'
import { categoryIcon } from '@/lib/category-icons'
import { categoryHref, postHref } from '@/lib/links'
import type {
  Category,
  CategoryFeatureBlock,
  CategoryGridBlock,
  CategoryListBlock,
  FeaturedSliderBlock,
} from '@/payload-types'

const asCategory = (value: unknown): Category | null =>
  value && typeof value === 'object' ? (value as Category) : null
const GRID_COLS = { '2': 'lg:grid-cols-2', '3': 'lg:grid-cols-3', '4': 'lg:grid-cols-4' } as const
const HERO_SLIDES_MAX = 5
const HERO_SIDE_MAX = 4
export const PANEL = 'h-full rounded-card bg-card p-4 shadow-card ring-1 ring-line/60 sm:p-6'

/**
 * One hero slide: the whole picture on top (never cropped; a blurred copy of it fills any spare
 * space when the picture is not 16:9), the story on a blue panel under it.
 */
function HeroSlide({ post, priority }: { post: PostCardData; priority: boolean }) {
  const forCard = { ...post, categoryName: categoryName(post) }
  return (
    <Link href={postHref(post.postNumber) ?? '#'} className="group flex h-full flex-col">
      <div className="relative aspect-[5/3] w-full shrink-0 overflow-hidden bg-[#041d4d]">
        <div className="absolute inset-0 scale-125 blur-2xl saturate-150" aria-hidden="true">
          <PostImage post={forCard} size="thumb" sizes="64px" cover className="!bg-transparent" />
        </div>
        <PostImage
          post={forCard}
          size="large"
          sizes="(min-width: 1280px) 860px, (min-width: 1024px) 62vw, 100vw"
          priority={priority}
          cover
          fit="contain"
          className="!bg-transparent"
        />
      </div>
      <div className="relative flex flex-1 flex-col justify-center gap-3 bg-gradient-to-b from-[#082f70] to-[#041d4d] px-5 pb-14 pt-5 sm:px-7 sm:pb-6 sm:pe-44 sm:pt-6 lg:px-8">
        <h2 className="line-clamp-2 max-w-3xl text-xl font-bold leading-snug text-white sm:text-2xl lg:text-[1.75rem] lg:leading-[1.3]">
          {post.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {categoryName(post) ? (
            <span className="inline-flex rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
              {categoryName(post)}
            </span>
          ) : null}
          <CardMeta post={post} light />
        </div>
      </div>
    </Link>
  )
}

/**
 * Hero: a crossfading slider of the featured stories on the left, the newest stories in a column on
 * the right (stacked under the slider on mobile).
 */
export async function FeaturedSlider({
  block,
  priority,
}: {
  block: FeaturedSliderBlock
  priority?: boolean
}) {
  const category = asCategory(block.category)
  const { docs } = await listPosts(
    block.source === 'category' && category
      ? { categoryId: category.id, limit: block.limit }
      : { featured: true, limit: block.limit },
  )
  if (!docs.length) return null
  const slides = docs.slice(0, HERO_SLIDES_MAX)
  const shown = new Set(slides.map((p) => p.id))
  const latest = await listPosts({ limit: HERO_SIDE_MAX + slides.length })
  const side = latest.docs.filter((p) => !shown.has(p.id)).slice(0, HERO_SIDE_MAX)
  return (
    <section
      aria-label="പ്രധാന വാർത്തകൾ"
      className={`grid grid-cols-1 gap-6 ${side.length ? 'lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-7' : ''}`}
    >
      <HeroSlider
        label="പ്രധാന വാർത്തകൾ"
        slides={slides.map((post, i) => (
          <HeroSlide key={post.id} post={post} priority={Boolean(priority) && i === 0} />
        ))}
      />
      {side.length ? (
        <div className="flex flex-col">
          <SectionHeading
            title={block.sideTitle || 'Featured Post'}
            icon={Star}
            href={category && block.source === 'category' ? categoryHref(category.slug) : null}
            className="enter"
          />
          <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-1">
            {side.map((post) => (
              <li key={post.id} className="[&>a]:h-full">
                <PostCard post={post} variant="side" hideCategory />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Category lead + list.
 * - split (സമകാലികം): navy lead card beside a list of news rows ("പ്രധാന ലേഖനങ്ങൾ").
 * - stacked (ലേഖനം): horizontal feature card beside rows with arrows ("അറിവിന്റെ വഴികൾ").
 * `half` = it shares the row with another block, so the lead and list get narrower columns.
 */
export async function CategoryFeature({
  block,
  priority,
  half = false,
  dense = false,
}: {
  block: CategoryFeatureBlock
  priority?: boolean
  half?: boolean
  /** A tighter list (smaller pictures, two-line titles, no repeated category): for a panel that has to match a shorter neighbour. */
  dense?: boolean
}) {
  const category = asCategory(block.category)
  if (!category) return null
  const { docs } = await listPosts({ categoryId: category.id, limit: block.limit })
  if (!docs.length) return null
  // The lead card is the big picture of the section, so it prefers a post that has one.
  const leadAt = Math.max(0, docs.findIndex(hasPicture))
  const lead = docs[leadAt]!
  const rest = docs.filter((_, i) => i !== leadAt)
  const more = block.showMoreLink ? categoryHref(category.slug) : null
  const stacked = block.layout === 'stacked'
  return (
    <section>
      <SectionHeading
        title={block.title || category.name}
        href={more}
        icon={categoryIcon(category)}
      />
      {stacked ? (
        <div
          className={`grid grid-cols-1 gap-4 ${half ? '' : 'lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-6'}`}
        >
          <PostCard post={lead} variant="feature" priority={priority} />
          {rest.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:auto-rows-fr">
              {rest.slice(0, 4).map((post) => (
                <li key={post.id} className="[&>a]:h-full">
                  <PostCard post={post} variant="list" hideCategory chevron />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 ${half ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-4' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-6'}`}
        >
          <PostCard post={lead} variant="lead" priority={priority} dense={dense} />
          {rest.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:auto-rows-fr">
              {rest.slice(0, 4).map((post) => (
                <li key={post.id} className="[&>a]:h-full">
                  <PostCard post={post} variant="row" dense={dense} hideCategory={dense} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  )
}

/** ചോദ്യോത്തരം-style card grid. */
export async function CategoryGrid({ block }: { block: CategoryGridBlock }) {
  const category = asCategory(block.category)
  if (!category) return null
  const { docs } = await listPosts({ categoryId: category.id, limit: block.limit })
  if (!docs.length) return null
  return (
    <section>
      <SectionHeading
        title={block.title || category.name}
        href={block.showMoreLink ? categoryHref(category.slug) : null}
        icon={categoryIcon(category)}
      />
      <ul
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 ${GRID_COLS[block.columns] ?? 'lg:grid-cols-3'}`}
      >
        {docs.map((post, i) => (
          <li key={post.id}>
            <PostCard post={post} variant="grid" hideCategory compactOnMobile={i > 0} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Compact list: thumbnails, or a ranked list (01, 02 …) when thumbnails are off. Panel style in sidebars. */
export async function CategoryList({
  block,
  panel,
}: {
  block: CategoryListBlock
  panel?: boolean
}) {
  const category = asCategory(block.category)
  if (!category) return null
  const { docs } = await listPosts({ categoryId: category.id, limit: block.limit })
  if (!docs.length) return null
  return (
    <section className={panel ? PANEL : ''}>
      <SectionHeading
        title={block.title || category.name}
        href={block.showMoreLink ? categoryHref(category.slug) : null}
        icon={categoryIcon(category)}
      />
      {/* Thumbnail rows are cards; the ranked text list keeps hairline dividers. */}
      <ul className={block.showThumbnails ? 'grid grid-cols-1 gap-3' : 'divide-y divide-line'}>
        {docs.map((post, i) => (
          <li key={post.id} className={block.showThumbnails ? '' : 'py-4 first:pt-0 last:pb-0'}>
            <PostCard
              post={post}
              variant={block.showThumbnails ? 'list' : 'compact'}
              index={i + 1}
              hideCategory
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
