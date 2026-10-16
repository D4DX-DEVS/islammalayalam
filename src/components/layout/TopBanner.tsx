import { getImageProps } from 'next/image'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { resolveLink } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import type { Header, Media } from '@/payload-types'

type Picture = { src: string; width: number; height: number }

const asPicture = (value: unknown): (Picture & { alt: string }) | null => {
  const media = value && typeof value === 'object' ? (value as Media) : null
  const src = mediaSrc(media?.sizes?.large?.url ?? media?.url)
  return media && src && media.width && media.height
    ? { src, width: media.width, height: media.height, alt: media.alt ?? '' }
    : null
}

/**
 * The top banner: an image right below the menu bar, as wide as the page content (the same
 * container as every section) with its height following the image, and an optional link (set in
 * Admin → Header & menu → Top banner). An optional phone version replaces the main image under
 * 640px. The box keeps each image's own proportions, so nothing is cropped and the page does not
 * jump while it loads.
 */
export function TopBanner({ banner }: { banner: Header['topBanner'] }) {
  if (!banner || banner.hidden) return null
  const wide = asPicture(banner.image)
  const narrow = asPicture(banner.mobileImage)
  const main = wide ?? narrow
  if (!main) return null
  const small = narrow ?? main
  const link = resolveLink(banner.link)

  const shared = { sizes: '100vw', quality: 90 } as const
  const big = getImageProps({
    ...shared,
    alt: main.alt,
    src: main.src,
    width: main.width,
    height: main.height,
    priority: true,
  })
  const little = getImageProps({
    ...shared,
    alt: small.alt,
    src: small.src,
    width: small.width,
    height: small.height,
  })

  const picture = (
    <span
      className="shine relative block w-full overflow-hidden rounded-card shadow-card ring-1 ring-line/60"
      style={
        {
          '--ratio-small': `${small.width} / ${small.height}`,
          '--ratio-wide': `${main.width} / ${main.height}`,
        } as React.CSSProperties
      }
    >
      <picture className="block aspect-(--ratio-small) w-full sm:aspect-(--ratio-wide)">
        <source media="(max-width: 639px)" srcSet={little.props.srcSet} sizes="100vw" />
        <source media="(min-width: 640px)" srcSet={big.props.srcSet} sizes="100vw" />
        <img
          src={big.props.src}
          srcSet={big.props.srcSet}
          sizes="100vw"
          alt={main.alt}
          width={main.width}
          height={main.height}
          fetchPriority="high"
          decoding="async"
          className="size-full object-cover"
        />
      </picture>
    </span>
  )

  return (
    <section aria-label="Banner" className="pt-4 sm:pt-5">
      <Container>
        {link?.href ? (
          <SmartLink
            href={link.href}
            external={link.external}
            newTab={link.newTab}
            className="block rounded-card transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {picture}
          </SmartLink>
        ) : (
          picture
        )}
      </Container>
    </section>
  )
}
