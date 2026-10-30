import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { SectionSkeleton, type SectionSkeletonVariant } from '@/components/skeletons'
import {
  CategoryFeature,
  CategoryGrid,
  CategoryList,
  FeaturedSlider,
} from '@/components/home/CategorySections'
import { LeadWithAside } from '@/components/home/LeadWithAside'
import { MediaShelf } from '@/components/home/MediaShelf'
import { ShortsSection } from '@/components/home/ShortsSection'
import { TopAdsSection } from '@/components/home/TopAdsSection'
import { TopicGrid } from '@/components/home/TopicGrid'
import {
  CallToActionSection,
  FaqSection,
  QuoteOfDaySection,
  ReelsSection,
} from '@/components/home/EngageSections'
import {
  BannerSection,
  FollowUsSection,
  QuickContactSection,
  QuickLinksSection,
  RichTextSection,
} from '@/components/home/MiscSections'
import { Container } from '@/components/ui/Container'
import type { CategoryFeatureBlock, Homepage, SiteSetting } from '@/payload-types'

type LayoutBlock = NonNullable<Homepage['layout']>[number]
type SidebarBlock = NonNullable<Homepage['sidebar']>[number]
type AnyBlock = LayoutBlock | SidebarBlock

const SKELETON: Record<string, SectionSkeletonVariant> = {
  featuredSlider: 'hero',
  categoryFeature: 'split',
  topicGrid: 'tiles',
  categoryGrid: 'grid',
  mediaShelf: 'band',
  categoryList: 'list',
  shorts: 'shorts',
  topAds: 'banner',
}

const isHalf = (block: AnyBlock) => 'width' in block && block.width === 'half'
/** A full-width video shelf is a band that runs edge to edge, outside the page container. */
const isBand = (block: AnyBlock) =>
  block.blockType === 'mediaShelf' && block.format === 'video' && !isHalf(block)

/**
 * The first "lead + list" section gets the daily-quote sidebar beside it (75% / 25%) — unless
 * editors placed a topics block themselves, in which case the layout is exactly what they built.
 */
function leadWithAside(blocks: LayoutBlock[]): CategoryFeatureBlock | null {
  if (blocks.some((b) => b.blockType === 'topicGrid')) return null
  const lead = blocks.find(
    (b) => b.blockType === 'categoryFeature' && b.layout !== 'stacked' && !isHalf(b),
  )
  return (lead as CategoryFeatureBlock | undefined) ?? null
}

function renderBlock(
  block: AnyBlock,
  settings: SiteSetting,
  opts: { priority: boolean; half: boolean; sidebar: boolean; bleed: boolean },
): ReactNode {
  switch (block.blockType) {
    case 'featuredSlider':
      return <FeaturedSlider block={block} priority={opts.priority} />
    case 'categoryFeature':
      return <CategoryFeature block={block} priority={opts.priority} half={opts.half} />
    case 'topicGrid':
      return <TopicGrid block={block} half={opts.half || opts.sidebar} />
    case 'categoryGrid':
      return <CategoryGrid block={block} />
    case 'categoryList':
      return <CategoryList block={block} panel={opts.sidebar || opts.half} />
    case 'mediaShelf':
      return <MediaShelf block={block} half={opts.half || opts.sidebar} bleed={opts.bleed} />
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
    case 'quoteOfDay':
      return <QuoteOfDaySection block={block} />
    case 'reels':
      return <ReelsSection block={block} compact={opts.sidebar || opts.half} />
    case 'shorts':
      return <ShortsSection block={block} />
    case 'topAds':
      return <TopAdsSection />
    case 'faq':
      return <FaqSection block={block} />
    case 'callToAction':
      return <CallToActionSection block={block} compact={opts.sidebar || opts.half} />
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

interface HomeBlocksProps {
  blocks: AnyBlock[]
  settings: SiteSetting
  /** Rendering the sidebar column: compact variants, no page-width rows. */
  sidebar?: boolean
  /** The caller already provides the page container (main column beside a sidebar). */
  contained?: boolean
  /** Rendered in its own container row right after the first row (the category icon strip). */
  afterFirst?: ReactNode
}

/**
 * Each section streams independently behind a skeleton shaped like it. In the page layout every
 * row sits in the site container, except the video band, which spans the full screen width.
 */
export function HomeBlocks({
  blocks,
  settings,
  sidebar = false,
  contained = false,
  afterFirst,
}: HomeBlocksProps) {
  const page = !sidebar && !contained
  const shown = blocks.filter((b) => !b.hidden)
  const asideBlock = page ? leadWithAside(shown as LayoutBlock[]) : null
  const rows = groupRows(shown)
  return (
    <div className={sidebar ? 'space-y-8' : 'space-y-10 lg:space-y-12'}>
      {rows.flatMap((row, r) => {
        const half = row.length > 1 || isHalf(row[0]!)
        const bleed = page && row.length === 1 && isBand(row[0]!)
        const cells = row.map((block, i) => (
          <Suspense
            key={block.id ?? `${r}-${i}`}
            fallback={<SectionSkeleton variant={SKELETON[block.blockType] ?? 'list'} />}
          >
            {block === asideBlock ? (
              <LeadWithAside
                block={asideBlock}
                priority={!sidebar && r < 2}
                siteName={settings.siteName}
                tagline={settings.tagline}
              />
            ) : (
              renderBlock(block, settings, { priority: !sidebar && r < 2, half, sidebar, bleed })
            )}
          </Suspense>
        ))
        const content = half ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">{cells}</div>
        ) : (
          <div>{cells}</div>
        )
        // Rows after the first two are rendered lazily (see .lazy-section in globals.css).
        const rowClass = [
          page && r >= 2 && row[0]!.blockType !== 'topAds' ? 'lazy-section' : '',
          // Follow Us is desktop-only (FollowUsSection); drop its row too so no empty gap is left.
          row.every((b) => b.blockType === 'followUs') ? 'max-lg:hidden' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const out: ReactNode[] = [
          page && !bleed ? (
            <Container key={`row-${r}`} className={rowClass}>
              {content}
            </Container>
          ) : (
            <div key={`row-${r}`} className={rowClass}>
              {content}
            </div>
          ),
        ]
        if (r === 0 && afterFirst)
          out.push(
            page ? (
              <Container key="after-first">{afterFirst}</Container>
            ) : (
              <div key="after-first">{afterFirst}</div>
            ),
          )
        return out
      })}
    </div>
  )
}
