import Image from 'next/image'
import { SmartLink } from '@/components/ui/SmartLink'
import { resolveLink } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import type { MediaShelfBlock } from '@/payload-types'

/**
 * Banner ads: a row of images, each with its own link, set on the e-book section in the admin
 * (Homepage → Media section → Banner ads). Images keep their own shape; nothing is cropped.
 */
export function BannerAds({ banners }: { banners: MediaShelfBlock['banners'] }) {
  const ads = (banners ?? []).flatMap((banner, i) => {
    const media = banner.image && typeof banner.image === 'object' ? banner.image : null
    // The original file, not the site's compressed "large" copy: ads carry small text and QR codes.
    const src = mediaSrc(media?.url)
    if (!media || !src || !media.width || !media.height) return []
    return [{ key: banner.id ?? String(i), media, src, link: resolveLink(banner.link) }]
  })
  if (!ads.length) return null

  return (
    <ul className="space-y-4" aria-label="Banners">
      {ads.map(({ key, media, src, link }) => {
        const image = (
          <span className="shine relative block overflow-hidden rounded-card shadow-card ring-1 ring-line/60">
            <Image
              src={src}
              alt={media.alt ?? ''}
              width={media.width!}
              height={media.height!}
              sizes="(min-width: 1024px) 40rem, 100vw"
              quality={90}
              className="h-auto w-full"
            />
          </span>
        )
        return (
          <li key={key} data-reveal="up" suppressHydrationWarning>
            {link?.href ? (
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
