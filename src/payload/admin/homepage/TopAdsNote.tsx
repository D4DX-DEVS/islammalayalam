'use client'

import Link from 'next/link'
import { useConfig } from '@payloadcms/ui'

/** Inside the "Top ads banner" section, which has nothing of its own to set: where its pictures are. */
export function TopAdsNote() {
  const { config } = useConfig()
  return (
    <p className="im-section-note">
      This section shows the banners from{' '}
      <Link href={`${config.routes.admin}/globals/ads-banners`} prefetch={false}>
        Ads banners → Top ads banner
      </Link>
      . Change the pictures and links there; here you only choose where on the page they appear.
    </p>
  )
}
