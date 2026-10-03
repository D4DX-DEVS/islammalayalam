import Image from 'next/image'
import Link from 'next/link'
import { mediaSrc } from '@/lib/media'
import type { Media, SiteSetting } from '@/payload-types'

interface BrandProps {
  settings: SiteSetting
  /** `light` = on the dark footer. */
  tone?: 'default' | 'light'
  /** Above the fold (header): fetch it early. */
  priority?: boolean
  className?: string
}

const asMedia = (value: SiteSetting['logo']): Media | null =>
  value && typeof value === 'object' ? value : null

/**
 * The site's own logo (public/brand, imported from the original site by
 * scripts/brand/import-logo.ts): blue lettering for light backgrounds, white lettering for the dark
 * footer and dark mode. A logo uploaded in Site settings replaces it.
 */
const LOGO = { src: '/brand/logo.png', width: 544, height: 180 }
const LOGO_ON_DARK = { src: '/brand/logo-mobile.png', width: 280, height: 93 }
const SIZE = 'h-11 w-auto sm:h-14'

export function Brand({ settings, tone = 'default', priority, className = '' }: BrandProps) {
  const uploaded = asMedia(settings.logo)
  const uploadedSrc = uploaded ? mediaSrc(uploaded.url) : null
  const alt = settings.siteNameMl
    ? `${settings.siteName} — ${settings.siteNameMl}`
    : settings.siteName
  const logo = (image: { src: string; width: number; height: number }, extra = '') => (
    <Image
      src={image.src}
      alt={alt}
      width={image.width}
      height={image.height}
      // Not `preload`: with the light/dark pair that would fetch the hidden one too (Next image docs).
      fetchPriority={priority ? 'high' : undefined}
      className={`${SIZE} ${extra}`}
      sizes="(min-width: 640px) 170px, 135px"
    />
  )
  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label={`${settings.siteName} — ഹോം`}
    >
      {uploaded && uploadedSrc && uploaded.width && uploaded.height ? (
        <span className={tone === 'light' ? 'rounded-xl bg-white px-3 py-2' : ''}>
          {logo({ src: uploadedSrc, width: uploaded.width, height: uploaded.height })}
        </span>
      ) : tone === 'light' ? (
        logo(LOGO_ON_DARK)
      ) : (
        <>
          {logo(LOGO, 'dark:hidden')}
          {logo(LOGO_ON_DARK, 'hidden dark:block')}
        </>
      )}
    </Link>
  )
}
