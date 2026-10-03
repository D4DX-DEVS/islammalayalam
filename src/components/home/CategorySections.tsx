import { PostCard } from '@/components/cards/PostCard'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { listPosts } from '@/features/posts/queries'
import { categoryHref } from '@/lib/links'
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
const HERO_SIDE_MAX = 4
export const PANEL = 'h-full rounded-[1.75rem] bg-surface p-5 sm:p-7'

/** Hero: the lead story as a large overlay card, the next stories in a side column (stacked on mobile). */
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
  const [lead, ...rest] = docs
  const side = rest.slice(0, HERO_SIDE_MAX)
  return (
    <section
      aria-label="പ്രധാന വാർത്തകൾ"
      className={`grid grid-cols-1 gap-6 ${side.length ? 'lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-8' : ''}`}
    >
      <PostCard post={lead!} variant="hero" priority={priority} headingLevel="h2" />
      {side.length ? (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
            ശ്രദ്ധേയം
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {side.map((post) => (
              <li key={post.id}>
                <PostCard post={post} variant="side" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/** Category lead + list: side-by-side (സമകാലികം) or a horizontal feature over a two-column list (ലേഖനം). */
export async function CategoryFeature({
  block,
  priority,
}: {
  block: CategoryFeatureBlock
  priority?: boolean
}) {
  const category = asCategory(block.category)
  if (!category) return null
  const { docs } = await listPosts({ categoryId: category.id, limit: block.limit })
  if (!docs.length) return null
  const [lead, ...rest] = docs
  const more = block.showMoreLink ? categoryHref(category.slug) : null
  return (
    <section>
      <SectionHeading title={block.title || category.name} href={more} />
      {block.layout === 'stacked' ? (
        <div className="space-y-8">
          <PostCard post={lead!} variant="feature" priority={priority} hideCategory />
          {rest.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rest.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} variant="list" hideCategory />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
          <PostCard post={lead!} variant="lead" priority={priority} hideCategory />
          {rest.length ? (
            <ul className="flex flex-col gap-4">
              {rest.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} variant="list" hideCategory />
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
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 ${GRID_COLS[block.columns] ?? 'lg:grid-cols-3'}`}
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
