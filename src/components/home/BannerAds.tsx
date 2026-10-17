import Image from 'next/image'
import { SmartLink } from '@/components/ui/SmartLink'
import type { Ad } from '@/lib/ads'

/**
 * The bottom ad banners: a column of images below the e-book shelf, each with its own link (Admin →
 * Ads banners → Bottom ads banner). Images keep their own shape; nothing is cropped.
 */
export function BannerAds({ ads }: { ads: Ad[] }) {
  if (!ads.length) return null
  return (
    <ul className="space-y-4" aria-label="Banners">
      {ads.map(({ key, picture, link }) => {
        const image = (
          <span className="shine relative block overflow-hidden rounded-card shadow-card ring-1 ring-line/60">
            <Image
              src={picture.src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              sizes="(min-width: 1024px) 40rem, 100vw"
              quality={90}
              className="h-auto w-full"
            />
          </span>
        )
        return (
          <li key={key} data-reveal="up" suppressHydrationWarning>
            {link ? (
              <SmartLink
                href={link.href}
                external={link.external}
                newTab={link.newTab}
                className="block rounded-card transition duration-300 hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {image}
              </SmartLink>
            ) : (
              image
            )}
          </li>
        )
      })}
    </ul>
  )
}
