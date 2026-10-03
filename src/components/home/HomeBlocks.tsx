import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { SectionSkeleton, type SectionSkeletonVariant } from '@/components/skeletons'
import {
  CategoryFeature,
  CategoryGrid,
  CategoryList,
  FeaturedSlider,
} from '@/components/home/CategorySections'
import { MediaShelf } from '@/components/home/MediaShelf'
import {
  BannerSection,
  FollowUsSection,
  QuickContactSection,
  QuickLinksSection,
  RichTextSection,
} from '@/components/home/MiscSections'
import type { Homepage, SiteSetting } from '@/payload-types'

type LayoutBlock = NonNullable<Homepage['layout']>[number]
type SidebarBlock = NonNullable<Homepage['sidebar']>[number]
type AnyBlock = LayoutBlock | SidebarBlock

const SKELETON: Record<string, SectionSkeletonVariant> = {
  featuredSlider: 'hero',
  categoryFeature: 'split',
  categoryGrid: 'grid',
  mediaShelf: 'band',
  categoryList: 'list',
}

function renderBlock(
  block: AnyBlock,
  settings: SiteSetting,
  opts: { priority: boolean; half: boolean; sidebar: boolean },
): ReactNode {
  switch (block.blockType) {
    case 'featuredSlider':
      return <FeaturedSlider block={block} priority={opts.priority} />
    case 'categoryFeature':
      return <CategoryFeature block={block} priority={opts.priority} />
    case 'categoryGrid':
      return <CategoryGrid block={block} />
    case 'categoryList':
      return <CategoryList block={block} panel={opts.sidebar || opts.half} />
    case 'mediaShelf':
      return <MediaShelf block={block} half={opts.half || opts.sidebar} />
    case 'richText':
      return <RichTextSection block={block} />
    case 'banner':
      return <BannerSection block={block} />
    case 'quickLinks':
      return <QuickLinksSection block={block} />
    case 'followUs':
      return <FollowUsSection block={block} settings={settings} />
    case 'quickContact':
      return <QuickContactSection block={block} settings={settings} />
    default:
      return null
  }
}

/** Group consecutive half-width blocks into pairs (side by side on desktop). */
function groupRows<T extends AnyBlock>(blocks: T[]): T[][] {
  const rows: T[][] = []
  for (const block of blocks) {
    const half = 'width' in block && block.width === 'half'
    const last = rows[rows.length - 1]
    if (half && last && last.length === 1 && 'width' in last[0]! && last[0]!.width === 'half')
      last.push(block)
    else rows.push([block])
  }
  return rows
}

/** Each section streams independently behind a skeleton shaped like it. */
export function HomeBlocks({
  blocks,
  settings,
  sidebar = false,
}: {
  blocks: AnyBlock[]
  settings: SiteSetting
  sidebar?: boolean
}) {
  return (
    <div className={sidebar ? 'space-y-8' : 'space-y-14 lg:space-y-16'}>
      {groupRows(blocks).map((row, r) => {
        const half = row.length > 1 || ('width' in row[0]! && row[0]!.width === 'half')
        const cells = row.map((block, i) => (
          <Suspense
            key={block.id ?? `${r}-${i}`}
            fallback={<SectionSkeleton variant={SKELETON[block.blockType] ?? 'list'} />}
          >
            {renderBlock(block, settings, { priority: !sidebar && r < 2, half, sidebar })}
          </Suspense>
        ))
        return half ? (
          <div key={r} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {cells}
          </div>
        ) : (
          <div key={r}>{cells}</div>
        )
      })}
    </div>
  )
}
