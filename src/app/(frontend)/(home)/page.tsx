import { Suspense } from 'react'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { HomeBlocks } from '@/components/home/HomeBlocks'
import { TopBanner } from '@/components/layout/TopBanner'
import { CategoryStrip } from '@/components/home/CategoryStrip'
import { getAds, getHomepage, getSiteSettings } from '@/features/site/queries'
import { placeTopAds } from '@/lib/top-ads'

export default async function HomePage() {
  const [home, settings, ads] = await Promise.all([getHomepage(), getSiteSettings(), getAds()])
  // The top banner is drawn where the Homepage layout has its section; with none, at the very top.
  const { layout, sidebar, atTop } = placeTopAds(
    home.layout ?? [],
    home.sidebar ?? [],
    ads.top.length > 0,
  )
  // Category shortcuts sit right under the hero.
  const strip = (
    <Suspense fallback={<div className="h-28" />}>
      <CategoryStrip />
    </Suspense>
  )

  return (
    <>
      {/* The top banner is for the homepage only: inner pages start straight under the menu. */}
      {atTop ? <TopBanner ads={ads.top} /> : null}
      <div className="py-5 lg:py-7">
        <h1 className="sr-only">
          {settings.siteNameMl
            ? `${settings.siteName} — ${settings.siteNameMl}`
            : settings.siteName}
        </h1>
        {layout.length === 0 && sidebar.length === 0 ? (
          <Container>
            <EmptyState
              title="ഹോംപേജ് ക്രമീകരിച്ചിട്ടില്ല"
              description="Admin → Settings → Homepage-ൽ വിഭാഗങ്ങൾ ചേർക്കുക."
            />
          </Container>
        ) : sidebar.length ? (
          <Container>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <HomeBlocks blocks={layout} settings={settings} contained afterFirst={strip} />
              <aside aria-label="സൈഡ്ബാർ" className="min-w-0">
                <HomeBlocks blocks={sidebar} settings={settings} sidebar />
              </aside>
            </div>
          </Container>
        ) : (
          <HomeBlocks blocks={layout} settings={settings} afterFirst={strip} />
        )}
      </div>
    </>
  )
}
