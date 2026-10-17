import { CategoryFeature } from '@/components/home/CategorySections'
import { InsightsCard } from '@/components/quotes/InsightsCard'
import { getLatestQuotes } from '@/features/quotes/queries'
import type { CategoryFeatureBlock } from '@/payload-types'

/** How many insights the slider holds: the first ones in the admin's order. */
const INSIGHTS_SHOWN = 5

/**
 * The first "lead + list" section in its own panel (75% of the row) with the sidebar beside it
 * (25%, never narrower than 21rem so the share row stays on one line): the Insights poster slider with its share options. Stacked on small screens. On wide screens the two
 * panels are the same height: the news list is compact, and whichever is shorter stretches (the
 * poster slider grows, or the news rows share the extra space).
 */
export async function LeadWithAside({
  block,
  priority,
  siteName,
  tagline,
}: {
  block: CategoryFeatureBlock
  priority?: boolean
  siteName: string
  tagline?: string | null
}) {
  const quotes = await getLatestQuotes(INSIGHTS_SHOWN)
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(21rem,1fr)] lg:items-stretch lg:gap-6">
      <div className="min-w-0 rounded-panel bg-card p-4 shadow-card ring-1 ring-line/60 sm:p-5">
        <CategoryFeature block={block} priority={priority} half dense />
      </div>
      <aside aria-label="Sidebar" className="mx-auto w-full min-w-0 max-w-md lg:max-w-none">
        <InsightsCard quotes={quotes} siteName={siteName} tagline={tagline} />
      </aside>
    </div>
  )
}
