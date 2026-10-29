/**
 * Short, plain names for the Homepage sections, shared by the block configs (the "Add section"
 * picker) and the row header in the editor (admin/homepage/SectionLabel.tsx). Pure: no Payload.
 * Kept short on purpose: the editor column is narrow beside the live preview.
 */
export const SECTION_NAMES: Record<string, string> = {
  featuredSlider: 'Hero slider',
  categoryFeature: 'Lead story + list',
  topicGrid: 'Topic tiles',
  categoryGrid: 'Card grid',
  categoryList: 'Compact list',
  mediaShelf: 'Videos, audio or e-books',
  richText: 'Text',
  banner: 'Banner image',
  topAds: 'Top ads banner',
  callToAction: 'Promo card',
  faq: 'FAQ',
  quoteOfDay: 'Quote of the day',
  reels: 'Reels',
  shorts: 'YouTube Shorts',
  quickLinks: 'Quick links',
  quickContact: 'Contact form',
  followUs: 'Follow us',
}

/** The "Add section" picker's groups, in the order they are listed. */
export const SECTION_GROUPS = {
  stories: 'Stories',
  media: 'Videos and audio',
  promo: 'Banners and promos',
  extras: 'Text and extras',
} as const

const MEDIA_FORMAT: Record<string, string> = { video: 'Videos', audio: 'Audio', ebook: 'E-books' }

export type SectionRowData = {
  blockType?: string
  blockName?: string | null
  title?: string | null
  heading?: string | null
  format?: string | null
  hidden?: boolean | null
}

/** The kind of section, e.g. "Card grid"; a media shelf says which media it lists. */
export function sectionType(row: SectionRowData): string {
  if (row.blockType === 'mediaShelf' && row.format && MEDIA_FORMAT[row.format])
    return MEDIA_FORMAT[row.format]!
  return SECTION_NAMES[row.blockType ?? ''] ?? 'Section'
}

/**
 * The name an editor recognises: the heading visitors see, else the name given to the row, else
 * the kind of section. `type` is left out when it would only repeat the name. Imported rows were
 * named "സമകാലികം — lead + list"; the part after " — " repeats the kind, which is shown beside it.
 */
export function sectionLabel(row: SectionRowData): { name: string; type: string | null } {
  const type = sectionType(row)
  const given = row.blockName?.split(' — ')[0]?.trim()
  const name = row.title?.trim() || row.heading?.trim() || given || type
  return { name, type: name === type ? null : type }
}
