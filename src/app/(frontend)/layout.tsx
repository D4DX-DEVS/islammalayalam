import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { MainNav } from '@/components/layout/MainNav'
import { Footer } from '@/components/layout/Footer'
import { BackToTop } from '@/components/layout/BackToTop'
import { WhatsAppButton } from '@/components/layout/WhatsAppButton'
import { MobileDock } from '@/components/layout/MobileDock'
import { ScrollDirection } from '@/components/layout/ScrollDirection'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import { PwaUpdater } from '@/components/pwa/PwaUpdater'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { PreviewBar } from '@/components/preview/PreviewBar'
import { getPreviewUser } from '@/features/preview/session'
import { aiSearchUiEnabled } from '@/features/ai-search/service'
import { getFooter, getHeader, getSiteSettings } from '@/features/site/queries'
import { fontVariables } from '@/lib/fonts'
import { toNavGroups, toNavTree } from '@/lib/nav'
import { whatsappLink } from '@/lib/whatsapp'
import { SITE_URL } from '@/lib/site-url'
import { absolute, siteJsonLd } from '@/lib/seo'
import { shareImage } from '@/lib/media'
import { JsonLd } from '@/components/seo/JsonLd'
import { parseTheme, THEME_COOKIE } from '@/lib/theme'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const name = settings.siteNameMl
    ? `${settings.siteName} | ${settings.siteNameMl}`
    : settings.siteName
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: name, template: `%s | ${settings.siteName}` },
    description: settings.tagline ?? undefined,
    // Pages that set their own openGraph replace this whole object, so they repeat siteName/locale.
    openGraph: {
      siteName: settings.siteName,
      locale: 'ml_IN',
      type: 'website',
      images: [shareImage(settings.defaultOgImage)],
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
    // The site's own emblem (public/brand). app/favicon.ico and app/manifest.ts add their own tags.
    icons: {
      icon: [
        { url: '/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  // Lets the dock pad itself for the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: 'cover',
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '/'
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  const [settings, header, footer, previewer] = await Promise.all([
    getSiteSettings(),
    getHeader(),
    getFooter(),
    getPreviewUser(),
  ])
  const navItems = toNavTree(header.mainMenu, 'nav')
  const whatsapp = whatsappLink({
    number: settings.contact?.whatsappNumber,
    message: settings.contact?.whatsappMessage,
    url: settings.social?.whatsapp,
  })

  return (
    // Light by default, whatever the OS prefers; dark only when the visitor picked it (theme cookie).
    <html lang="ml" data-theme={theme ?? 'light'} className={fontVariables}>
      <body id="top" className="flex min-h-dvh flex-col">
        <JsonLd
          data={siteJsonLd({
            name: settings.siteName,
            alternateName: settings.siteNameMl,
            description: settings.tagline,
            logo: absolute('/brand/icon-512.png'),
            profiles: Object.values(settings.social ?? {}),
            email: settings.contact?.email,
          })}
        />
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          Skip to content
        </a>
        {previewer ? <PreviewBar pathname={pathname} /> : null}
        <SiteHeader
          settings={settings}
          topLinks={toNavTree(header.topBarLinks, 'top')}
          navItems={navItems}
          quickLinks={toNavGroups(footer.columns)}
          showSocial={header.showSocialInTopBar !== false}
          pathname={pathname}
          aiSearch={aiSearchUiEnabled()}
        />
        <MainNav items={navItems} pathname={pathname} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer footer={footer} settings={settings} />
        <BackToTop />
        {whatsapp ? <WhatsAppButton href={whatsapp} /> : null}
        <MobileDock whatsapp={whatsapp} />
        <InstallBanner />
        <PwaUpdater />
        <ScrollDirection />
        <ScrollReveal />
      </body>
    </html>
  )
}
