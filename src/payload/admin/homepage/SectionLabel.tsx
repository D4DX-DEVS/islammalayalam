'use client'

import { useRowLabel } from '@payloadcms/ui'
import { EyeOff } from 'lucide-react'
import { sectionLabel, type SectionRowData } from '@/payload/blocks/sectionNames'

/**
 * Header of one Homepage section in the editor, in place of Payload's "number · type pill · block
 * name" (which cut both off in the narrow column beside the live preview). One readable name, the
 * kind of section under it, and a "Hidden" badge when "Hide this section" is ticked.
 */
export function SectionLabel() {
  const { data, rowNumber } = useRowLabel<SectionRowData>()
  const { name, type } = sectionLabel(data ?? {})
  return (
    <span className={`im-section-label${data?.hidden ? ' is-hidden' : ''}`}>
      <span className="im-section-label__num" aria-hidden="true">
        {String((rowNumber ?? 0) + 1).padStart(2, '0')}
      </span>
      <span className="im-section-label__text">
        <span className="im-section-label__name">{name}</span>
        {type ? <span className="im-section-label__type">{type}</span> : null}
      </span>
      {data?.hidden ? (
        <span className="im-section-label__hidden">
          <EyeOff aria-hidden="true" />
          Hidden
        </span>
      ) : null}
    </span>
  )
}
