import Link from 'next/link'
import { PostCard, CardMeta, categoryName } from '@/components/cards/PostCard'
import { PostImage, hasPicture } from '@/components/cards/PostImage'
import { HeroSlider } from '@/components/home/HeroSlider'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listPosts, type PostCardData } from '@/features/posts/queries'
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

/** One hero slide: full-bleed image with the story on a blue gradient. */
function HeroSlide({ post, priority }: { post: PostCardData; priority: boolean }) {
  return (
    <Link
      href={postHref(post.postNumber) ?? '#'}
      className="group relative flex h-full flex-col justify-end"
    >
      <PostImage
        post={{ ...post, categoryName: categoryName(post) }}
        size="large"
        sizes="(min-width: 1280px) 860px, (min-width: 1024px) 62vw, 100vw"
        priority={priority}
        cover
        className="motion-safe:[[data-active]_&]:animate-kenburns"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#041d4d]/95 via-[#082f70]/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#041d4d]/55 via-transparent to-transparent" />
      <div className="relative space-y-3.5 p-6 pb-[4.5rem] sm:p-8 sm:pb-8 sm:pe-44 lg:p-10 lg:pb-9">
        <div className="space-y-3.5 motion-safe:[[data-active]_&]:animate-[enter-up_0.8s_0.15s_both]">
          {categoryName(post) ? (
            <span className="inline-flex rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
              {categoryName(post)}
            </span>
          ) : null}
          <h2 className="line-clamp-4 max-w-3xl text-2xl font-bold leading-snug text-white sm:text-3xl lg:text-[2.3rem] lg:leading-[1.3]">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="hidden max-w-2xl text-[0.95rem] text-white/85 sm:line-clamp-2">
              {post.excerpt}
            </p>
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
        className="min-h-[26rem] lg:min-h-[30rem]"
        slides={slides.map((post, i) => (
          <HeroSlide key={post.id} post={post} priority={Boolean(priority) && i === 0} />
        ))}
      />
      {side.length ? (
        <div className="flex flex-col">
          <SectionHeading
            title={block.sideTitle || 'Featured Post'}
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
}: {
  block: CategoryFeatureBlock
  priority?: boolean
  half?: boolean
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
      <SectionHeading title={block.title || category.name} href={more} />
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
          <PostCard post={lead} variant="lead" priority={priority} />
          {rest.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:auto-rows-fr">
              {rest.slice(0, 4).map((post) => (
                <li key={post.id} className="[&>a]:h-full">
                  <PostCard post={post} variant="row" />
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
