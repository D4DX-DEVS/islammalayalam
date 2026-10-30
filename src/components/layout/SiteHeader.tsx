import Image from 'next/image'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { Brand } from '@/components/layout/Brand'
import { MobileNav } from '@/components/layout/MobileNav'
import { SearchForm } from '@/components/layout/SearchForm'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { mediaSrc } from '@/lib/media'
import type { NavGroup, NavItem } from '@/lib/nav'
import type { Media, SiteSetting } from '@/payload-types'

interface SiteHeaderProps {
  settings: SiteSetting
  topLinks: NavItem[]
  navItems: NavItem[]
  /** The footer's link columns: on phones they live in the menu drawer instead of the footer. */
  quickLinks?: NavGroup[]
  showSocial: boolean
  pathname: string
  /** Show the AI button in the search boxes. */
  aiSearch?: boolean
}

function PartnerLogo({ settings }: { settings: SiteSetting }) {
  const media =
    settings.partnerLogo && typeof settings.partnerLogo === 'object'
      ? (settings.partnerLogo as Media)
      : null
  const src = media ? mediaSrc(media.url) : null
  if (!media || !src || !media.width || !media.height) return null
  const img = (
    <Image
      src={src}
      alt={media.alt || 'Partner'}
      width={media.width}
      height={media.height}
      className="h-9 w-auto"
      sizes="160px"
    />
  )
  return settings.partnerUrl ? (
    <a
      href={settings.partnerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden shrink-0 xl:inline-flex"
    >
      {img}
    </a>
  ) : (
    <span className="hidden shrink-0 xl:inline-flex">{img}</span>
  )
}

/**
 * Masthead. Below `xl` it is the sticky app bar (menu · logo · search · theme); from `xl` it scrolls
 * away and the MainNav bar underneath becomes the sticky element. Below `xl` it slides away while
 * scrolling down and back on scroll up (`.mobile-header`, globals.css).
 */
export function SiteHeader({
  settings,
  topLinks,
  navItems,
  quickLinks = [],
  showSocial,
  pathname,
  aiSearch = false,
}: SiteHeaderProps) {
  return (
    <header className="mobile-header sticky top-0 z-40 border-b border-line/60 bg-card/80 backdrop-blur-xl xl:static xl:bg-card">
      <Container className="flex h-16 items-center gap-1.5 sm:h-[4.5rem] xl:h-20 xl:gap-4">
        <MobileNav
          items={navItems}
          quickLinks={quickLinks}
          pathname={pathname}
          topLinks={topLinks}
          social={settings.social}
          siteName={settings.siteName}
          tagline={settings.tagline}
          aiSearch={aiSearch}
        />
        <Brand settings={settings} priority />
        <div className="ms-auto flex items-center gap-1 sm:gap-2 xl:gap-4">
          {topLinks.length ? (
            <ul className="hidden items-center divide-x divide-line lg:flex">
              {topLinks.map((l) => (
                <li key={l.id} className="px-4 first:ps-0 last:pe-0">
                  <SmartLink
                    href={l.href}
                    external={l.external}
                    newTab={l.newTab}
                    className={
                      l.highlight
                        ? 'inline-flex min-h-10 items-center rounded-full bg-accent-strong px-5 text-sm font-semibold text-on-accent shadow-card ring-1 ring-black/5 transition hover:-translate-y-px hover:shadow-lift'
                        : 'text-sm font-medium text-muted transition-colors hover:text-brand'
                    }
                  >
                    {l.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          ) : null}
          {showSocial ? (
            <SocialLinks social={settings.social} variant="brand" className="hidden xl:flex" />
          ) : null}
          <PartnerLogo settings={settings} />
          <SearchForm ai={aiSearch} className="hidden w-60 md:flex xl:w-80" />
          <ThemeToggle className="-me-2 sm:me-0" />
        </div>
      </Container>
    </header>
  )
}
