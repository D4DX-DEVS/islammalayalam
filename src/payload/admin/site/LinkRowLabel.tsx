'use client'

import { useRowLabel } from '@payloadcms/ui'

type LinkRow = {
  link?: { label?: string | null } | null
  title?: string | null
  highlight?: boolean | null
  children?: unknown[] | null
  links?: unknown[] | null
  /** Footer columns: only a "Links" column shows its links (others keep old ones, unused). */
  kind?: string | null
}

/**
 * Name of a folded menu / footer row: the text visitors see ("About us", "Quick Links"), how many
 * links sit under it, and whether it is shown as a button. Without it every row read "Main Menu 01",
 * "Main Menu 02"… and had to be opened to find the right one.
 */
export function LinkRowLabel() {
  const { data, rowNumber } = useRowLabel<LinkRow>()
  const name = data?.link?.label?.trim() || data?.title?.trim() || `Item ${(rowNumber ?? 0) + 1}`
  const links = !data?.kind || data.kind === 'links' ? data?.links?.length : 0
  const under = data?.children?.length ?? links ?? 0
  const extra = [
    under ? `${under} ${under === 1 ? 'link' : 'links'} inside` : '',
    data?.highlight ? 'button' : '',
  ].filter(Boolean)
  return (
    <span className="im-link-label">
      <span className="im-link-label__name">{name}</span>
      {extra.length ? <span className="im-link-label__meta">{extra.join(' · ')}</span> : null}
    </span>
  )
}
