import { mediaSrc } from '@/lib/media'
import { isSafeHref } from '@/lib/security/url'
import type { AdsBanner, Media } from '@/payload-types'

/**
 * Ad banners as the site shows them: the top ones under the menu on the homepage, the bottom ones
 * under the e-book shelf. Both come from Admin → Ads banners; this turns what is stored there into
 * what can be drawn, dropping hidden banners, banners without a usable image and unsafe links.
 */
export type AdLink = { href: string; external: boolean; newTab: boolean }
export type AdPicture = { src: string; width: number; height: number }
export type Ad = {
  key: string
  picture: AdPicture & { alt: string }
  /** A narrower version for phones, when the editor added one. */
  phone: AdPicture | null
  link: AdLink | null
}
type Stored = NonNullable<AdsBanner['top']>[number]

const asMedia = (value: unknown): Media | null =>
  value && typeof value === 'object' ? (value as Media) : null

/** The original file, not the site's compressed copy: ads carry small text and QR codes. */
function picture(value: unknown): (AdPicture & { alt: string }) | null {
  const media = asMedia(value)
  const src = mediaSrc(media?.url)
  return media && src && media.width && media.height
    ? { src, width: media.width, height: media.height, alt: media.alt ?? '' }
    : null
}

/** The click target of an ad: a web address or a page of this site; null for no (or an unsafe) link. */
export function adLink(
  url: string | null | undefined,
  openIn: string | null | undefined,
): AdLink | null {
  const href = (url ?? '').trim()
  const web = /^https?:\/\//i.test(href)
  if (!href || !isSafeHref(href) || !(web || href.startsWith('/'))) return null
  // "Open in" is a choice the editor makes; unset counts as the field's default, a new tab.
  return { href, external: web, newTab: openIn !== 'same' }
}

export function toAds(items: Stored[] | null | undefined): Ad[] {
  return (items ?? []).flatMap((item, i) => {
    if (item.active === false) return []
    const main = picture(item.image)
    if (!main) return []
    const phone = picture(item.mobileImage)
    const alt = (item.alt ?? '').trim() || main.alt
    return [
      {
        key: item.id ?? String(i),
        picture: { ...main, alt },
        phone: phone ? { src: phone.src, width: phone.width, height: phone.height } : null,
        link: adLink(item.url, item.openIn),
      },
    ]
  })
}
