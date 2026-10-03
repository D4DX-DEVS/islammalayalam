import Image from 'next/image'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { Brand } from '@/components/layout/Brand'
import { MobileNav } from '@/components/layout/MobileNav'
import { SearchForm, SEARCH_PATH } from '@/components/layout/SearchForm'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { mediaSrc } from '@/lib/media'
import type { NavItem } from '@/lib/nav'
import type { Media, SiteSetting } from '@/payload-types'

interface SiteHeaderProps {
  settings: SiteSetting
  topLinks: NavItem[]
  navItems: NavItem[]
  showSocial: boolean
  pathname: string
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
 * away and the MainNav bar underneath becomes the sticky element.
 */
export function SiteHeader({
  settings,
  topLinks,
  navItems,
  showSocial,
  pathname,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur-md xl:static xl:bg-card">
      <Container className="flex h-16 items-center gap-1.5 sm:h-[4.5rem] xl:h-20 xl:gap-4">
        <MobileNav
          items={navItems}
          pathname={pathname}
          topLinks={topLinks}
          social={settings.social}
        />
        <Brand settings={settings} priority />
        <div className="ms-auto flex items-center gap-1 sm:gap-2 xl:gap-4">
          {topLinks.length ? (
            <ul className="hidden items-center gap-5 lg:flex">
              {topLinks.map((l) => (
                <li key={l.id}>
                  <SmartLink
                    href={l.href}
                    external={l.external}
                    newTab={l.newTab}
                    className="text-sm font-medium text-muted transition-colors hover:text-brand"
                  >
                    {l.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          ) : null}
          {showSocial ? (
            <SocialLinks social={settings.social} className="hidden text-muted xl:flex" />
          ) : null}
          <PartnerLogo settings={settings} />
          <SearchForm className="hidden w-60 md:flex xl:w-72" />
          <Link
            href={SEARCH_PATH}
            aria-label="തിരയുക"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface hover:text-brand md:hidden"
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <ThemeToggle className="-me-2 sm:me-0" />
        </div>
      </Container>
    </header>
  )
}
