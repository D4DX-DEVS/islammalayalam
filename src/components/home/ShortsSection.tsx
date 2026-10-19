import { Smartphone } from 'lucide-react'
import { ShortsCarousel } from '@/components/home/ShortsCarousel'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getChannelShorts } from '@/features/shorts/queries'
import { shortsPage } from '@/lib/youtube-shorts'
import type { ShortsBlock } from '@/payload-types'

/**
 * The latest YouTube Shorts of a channel as a swipeable row of vertical posters. The list is read
 * from the channel itself (features/shorts), so new Shorts appear without anyone editing the site.
 */
export async function ShortsSection({ block }: { block: ShortsBlock }) {
  const shorts = await getChannelShorts(block.channel, block.limit)
  if (!shorts.length) return null
  const title = block.title || 'Shorts'
  return (
    <section
      aria-label={title}
      className="relative isolate overflow-hidden rounded-panel bg-gradient-to-br from-brand-soft via-card to-card px-4 py-6 shadow-card ring-1 ring-brand/10 sm:px-7 sm:py-8"
    >
      <span
        className="pointer-events-none absolute -end-20 -top-24 -z-10 size-80 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-24 -start-20 -z-10 size-72 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <SectionHeading
        title={title}
        href={shortsPage(block.channel)}
        external
        moreLabel="View all on YouTube"
        icon={Smartphone}
        tint="red"
      />
      <ShortsCarousel shorts={shorts} label={title} />
    </section>
  )
}
