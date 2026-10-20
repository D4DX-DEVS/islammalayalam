import { getImageProps } from 'next/image'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import type { Ad } from '@/lib/ads'

/** One top ad: as wide as the page content, its height following the image (nothing is cropped). */
function TopAd({ ad, priority }: { ad: Ad; priority: boolean }) {
  const main = ad.picture
  const small = ad.phone ?? main
  const shared = { sizes: '100vw', quality: 90 } as const
  const big = getImageProps({
    ...shared,
    alt: main.alt,
    src: main.src,
    width: main.width,
    height: main.height,
    priority,
  })
  const little = getImageProps({
    ...shared,
    alt: small === main ? main.alt : '',
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
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? undefined : 'lazy'}
          decoding="async"
          className="size-full object-cover"
        />
      </picture>
    </span>
  )
  return ad.link ? (
    <SmartLink
      href={ad.link.href}
      external={ad.link.external}
      newTab={ad.link.newTab}
      className="block rounded-card transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {picture}
    </SmartLink>
  ) : (
    picture
  )
}

/**
 * The top ad banners (Admin → Ads banners → Top ads banner): one below the other, each as wide as
 * the page content with its own link. A phone version replaces the main image under 640px. The box
 * keeps each image's own proportions, so nothing is cropped and the page does not jump while it
 * loads. By default they sit right below the menu bar of the homepage; with `inline` they are a
 * section of the homepage layout (the page's container and spacing come from the layout), so they
 * can be moved anywhere in it.
 */
export function TopBanner({ ads, inline = false }: { ads: Ad[]; inline?: boolean }) {
  if (!ads.length) return null
  const list = (
    <ul className="space-y-3 sm:space-y-4">
      {ads.map((ad, i) => (
        <li key={ad.key}>
          <TopAd ad={ad} priority={i === 0 && !inline} />
        </li>
      ))}
    </ul>
  )
  return inline ? (
    <section aria-label="Banner">{list}</section>
  ) : (
    <section aria-label="Banner" className="pt-4 sm:pt-5">
      <Container>{list}</Container>
    </section>
  )
}
