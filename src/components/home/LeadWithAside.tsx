import { CategoryFeature } from '@/components/home/CategorySections'
import { DailyQuoteCard } from '@/components/quotes/DailyQuoteCard'
import { getDailyQuote } from '@/features/quotes/queries'
import { istDayKey } from '@/lib/quote'
import type { CategoryFeatureBlock } from '@/payload-types'

/**
 * The first "lead + list" section in its own panel (75% of the row) with the sidebar beside it
 * (25%, never narrower than 21rem so the share row stays on one line): today's quote poster with its share options. Stacked on small screens. On wide screens the
 * sidebar keeps its own height and stays in view under the menu while the taller news panel
 * scrolls past.
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
  const quote = await getDailyQuote(istDayKey(new Date()) ?? '')
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(21rem,1fr)] lg:gap-6">
      <div className="min-w-0 rounded-panel bg-card p-4 shadow-card ring-1 ring-line/60 sm:p-6">
        <CategoryFeature block={block} priority={priority} half />
      </div>
      <aside
        aria-label="Sidebar"
        className="mx-auto w-full min-w-0 max-w-md lg:sticky lg:top-24 lg:max-w-none lg:self-start"
      >
        <DailyQuoteCard quote={quote} siteName={siteName} tagline={tagline} />
      </aside>
    </div>
  )
}
