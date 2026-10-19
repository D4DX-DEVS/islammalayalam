import type { SectionRow } from '@/payload/admin/websiteModel'
import type { AdsBanner } from '@/payload-types'

/** What the website manager says about the ad banner lists (Admin → Ads banners). */
type AdRows = AdsBanner['top']
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** How many banners of a list are switched on and have a picture. */
export const shownAds = (rows: AdRows | undefined): number =>
  (rows ?? []).filter((r) => r.active !== false && r.image).length

export function adsDetail(rows: AdRows | undefined, what: string, empty: string): string {
  const on = shownAds(rows)
  const off = (rows?.length ?? 0) - on
  if (!on)
    return off ? 'All hidden: tick “Show this banner” on one of them to bring it back' : empty
  return `${what} · ${plural(on, 'banner')}${off ? ` (${off} hidden)` : ''}`
}

/** The website-manager row for one banner list. */
export function adsRow(opts: {
  key: string
  label: string
  rows: AdRows | undefined
  what: string
  empty: string
  editHref: string | null
}): SectionRow {
  return {
    key: opts.key,
    label: opts.label,
    icon: 'banner',
    detail: adsDetail(opts.rows, opts.what, opts.empty),
    editHref: opts.editHref,
    editLabel: shownAds(opts.rows) ? 'Edit banners' : 'Add a banner',
    viewHref: '/',
  }
}
