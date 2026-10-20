import { TopBanner } from '@/components/layout/TopBanner'
import { getAds } from '@/features/site/queries'

/** The "Top ads banner" homepage section: the banners from Admin → Ads banners, drawn where the section sits. */
export async function TopAdsSection() {
  const { top } = await getAds()
  return <TopBanner ads={top} inline />
}
