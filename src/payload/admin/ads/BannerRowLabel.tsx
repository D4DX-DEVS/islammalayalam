'use client'

import { useRowLabel } from '@payloadcms/ui'

/** Name of a row in the Ads banners lists: its own name, else where it links to, else "Banner 2". */
export function BannerRowLabel() {
  const { data, rowNumber } = useRowLabel<{ name?: string; url?: string; active?: boolean }>()
  const number = (rowNumber ?? 0) + 1
  const name = data?.name?.trim()
  let host = ''
  try {
    host = data?.url ? new URL(data.url, 'https://site.invalid').hostname.replace(/^www\./, '') : ''
  } catch {
    host = ''
  }
  const label =
    name || (host && host !== 'site.invalid' ? `Banner ${number} → ${host}` : `Banner ${number}`)
  return <span>{data?.active === false ? `${label} (hidden)` : label}</span>
}
