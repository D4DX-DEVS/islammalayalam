import { Suspense } from 'react'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { HomeBlocks } from '@/components/home/HomeBlocks'
import { TopicChips } from '@/components/home/TopicChips'
import { getHomepage, getSiteSettings } from '@/features/site/queries'

export default async function HomePage() {
  const [home, settings] = await Promise.all([getHomepage(), getSiteSettings()])
  const layout = home.layout ?? []
  const sidebar = home.sidebar ?? []

  return (
    <Container className="space-y-8 py-6 lg:space-y-10 lg:py-8">
      <h1 className="sr-only">
        {settings.siteNameMl ? `${settings.siteName} — ${settings.siteNameMl}` : settings.siteName}
      </h1>
      <Suspense fallback={<div className="h-10" />}>
        <TopicChips />
      </Suspense>
      {layout.length === 0 && sidebar.length === 0 ? (
        <EmptyState
          title="ഹോംപേജ് ക്രമീകരിച്ചിട്ടില്ല"
          description="Admin → Settings → Homepage-ൽ വിഭാഗങ്ങൾ ചേർക്കുക."
        />
      ) : (
        <div className={sidebar.length ? 'grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem]' : ''}>
          <HomeBlocks blocks={layout} settings={settings} />
          {sidebar.length ? (
            <aside aria-label="സൈഡ്ബാർ">
              <HomeBlocks blocks={sidebar} settings={settings} sidebar />
            </aside>
          ) : null}
        </div>
      )}
    </Container>
  )
}
