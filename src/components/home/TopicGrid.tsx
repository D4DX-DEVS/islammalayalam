import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CARD } from '@/components/cards/PostCard'
import { PostImage } from '@/components/cards/PostImage'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { CountUp } from '@/components/ui/CountUp'
import { listTopicCategories, type TopicCategory } from '@/features/categories/queries'
import { listPosts } from '@/features/posts/queries'
import { categoryHref } from '@/lib/links'
import type { Category, TopicGridBlock } from '@/payload-types'

/** Shelves that exist for a format, not a subject: skipped when the tiles are chosen automatically. */
const FORMAT_SLUGS = new Set(['videos', 'audios', 'e-books'])

const isCategory = (value: unknown): value is Category =>
  Boolean(value) && typeof value === 'object'

/**
 * Topic tiles: image, name, article count. The image is the category's own, else the picture of its
 * latest post, else the designed fallback; the count is the number of published posts.
 */
export async function TopicGrid({ block, half }: { block: TopicGridBlock; half: boolean }) {
  const picked = (block.categories ?? []).filter(isCategory) as TopicCategory[]
  const categories = picked.length
    ? picked.slice(0, block.limit)
    : (await listTopicCategories()).filter((c) => !FORMAT_SLUGS.has(c.slug)).slice(0, block.limit)
  if (!categories.length) return null

  const tiles = await Promise.all(
    categories.map(async (category) => {
      const { docs, totalDocs } = await listPosts({ categoryId: category.id, limit: 1 })
      return { category, latest: docs[0] ?? null, total: totalDocs }
    }),
  )

  return (
    <section>
      <SectionHeading title={block.title || 'തിരഞ്ഞെടുക്ക വിഷയങ്ങൾ'} />
      <ul className={`grid grid-cols-2 gap-3 sm:gap-4 ${half ? '' : 'lg:grid-cols-4'}`}>
        {tiles.map(({ category, latest, total }) => {
          const own = isCategory(category.image) ? category.image : null
          return (
            <li key={category.id} data-reveal="up" suppressHydrationWarning className="h-full">
              <Link
                href={categoryHref(category.slug) ?? '#'}
                className={`group flex h-full flex-col overflow-hidden ${CARD}`}
              >
                <PostImage
                  post={{
                    featuredImage: own ?? latest?.featuredImage ?? null,
                    format: 'standard',
                    categoryName: category.name,
                    title: category.name,
                  }}
                  size="card"
                  sizes="(min-width: 1280px) 300px, 45vw"
                  className="aspect-[16/9]"
                />
                <div className="flex items-center justify-between gap-2 p-3 sm:gap-3 sm:p-4">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-[0.95rem] font-bold leading-snug sm:text-base text-ink transition-colors group-hover:text-brand">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      <CountUp value={total} /> ലേഖനങ്ങൾ
                    </p>
                  </div>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted transition duration-300 group-hover:translate-x-1 group-hover:text-brand rtl:rotate-180"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
