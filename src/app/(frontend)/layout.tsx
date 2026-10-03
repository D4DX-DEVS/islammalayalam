import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { MainNav } from '@/components/layout/MainNav'
import { Footer } from '@/components/layout/Footer'
import { BackToTop } from '@/components/layout/BackToTop'
import { PreviewBar } from '@/components/preview/PreviewBar'
import { getPreviewUser } from '@/features/preview/session'
import { getFooter, getHeader, getSiteSettings } from '@/features/site/queries'
import { fontVariables } from '@/lib/fonts'
import { toNavTree } from '@/lib/nav'
import { parseTheme, THEME_COOKIE } from '@/lib/theme'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const name = settings.siteNameMl
    ? `${settings.siteName} | ${settings.siteNameMl}`
    : settings.siteName
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3444'),
    title: { default: name, template: `%s | ${settings.siteName}` },
    description: settings.tagline ?? undefined,
    openGraph: { siteName: settings.siteName, locale: 'ml_IN', type: 'website' },
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1426' },
  ],
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

  return (
    // No data-theme → the OS preference applies (CSS); a saved choice comes from the theme cookie.
    <html lang="ml" data-theme={theme} className={fontVariables}>
      <body id="top" className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          ഉള്ളടക്കത്തിലേക്ക് പോകുക
        </a>
        {previewer ? <PreviewBar pathname={pathname} /> : null}
        <SiteHeader
          settings={settings}
          topLinks={toNavTree(header.topBarLinks, 'top')}
          navItems={navItems}
          showSocial={header.showSocialInTopBar !== false}
          pathname={pathname}
        />
        <MainNav items={navItems} pathname={pathname} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer footer={footer} settings={settings} />
        <BackToTop />
      </body>
    </html>
  )
}
