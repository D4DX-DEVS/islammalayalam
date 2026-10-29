import type { Block, Field } from 'payload'
import { linkGroup, validateSpotifyLink } from '@/payload/fields'
import { simpleEditor } from '@/payload/editor'
import {
  CallToActionBlock,
  FaqBlock,
  QuoteOfDayBlock,
  ReelsBlock,
  ShortsBlock,
} from './homepage-engage'
import { SECTION_GROUPS, SECTION_NAMES } from './sectionNames'

/**
 * Homepage / sidebar layout blocks. Editors compose the homepage from these in the Homepage
 * global; each maps 1:1 to a server component in src/components/home/*. Same sections as the
 * original site (audit §2.3) in the modern news-magazine design: hero, lead + list, card grids,
 * video band, e-book shelf, audio list.
 */
const title: Field = {
  name: 'title',
  type: 'text',
  maxLength: 80,
  admin: { description: 'Section heading. Defaults to the category name.' },
}
const limit = (defaultValue: number, max = 12): Field => ({
  name: 'limit',
  type: 'number',
  defaultValue,
  min: 1,
  max,
  required: true,
})
const showMore: Field = {
  name: 'showMoreLink',
  type: 'checkbox',
  defaultValue: true,
  label: 'Show "more" link to the category',
}
const width: Field = {
  name: 'width',
  type: 'radio',
  defaultValue: 'full',
  options: [
    { label: 'Full width', value: 'full' },
    { label: 'Half (two consecutive half blocks sit side by side on desktop)', value: 'half' },
  ],
}
const category = (required = true): Field => ({
  name: 'category',
  type: 'relationship',
  relationTo: 'categories',
  required,
})

export const FeaturedSliderBlock: Block = {
  slug: 'featuredSlider',
  interfaceName: 'FeaturedSliderBlock',
  labels: { singular: SECTION_NAMES.featuredSlider!, plural: 'Hero sliders' },
  admin: { group: SECTION_GROUPS.stories },
  fields: [
    {
      name: 'source',
      type: 'radio',
      defaultValue: 'featured',
      options: [
        { label: 'Posts marked "Featured"', value: 'featured' },
        { label: 'A category', value: 'category' },
      ],
    },
    { ...category(false), admin: { condition: (_, s) => s?.source === 'category' } } as Field,
    limit(6, 10),
    {
      name: 'sideTitle',
      type: 'text',
      maxLength: 60,
      defaultValue: 'Featured Post',
      admin: { description: 'Heading of the stories column beside the slider.' },
    },
  ],
}

export const CategoryFeatureBlock: Block = {
  slug: 'categoryFeature',
  interfaceName: 'CategoryFeatureBlock',
  labels: { singular: SECTION_NAMES.categoryFeature!, plural: 'Lead stories + lists' },
  admin: { group: SECTION_GROUPS.stories },
  fields: [
    width,
    category(),
    title,
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'split',
      required: true,
      options: [
        { label: 'Lead left, list right (സമകാലികം)', value: 'split' },
        { label: 'Lead on top, two-column list below (ലേഖനം)', value: 'stacked' },
      ],
    },
    limit(5, 9),
    showMore,
  ],
}

export const TopicGridBlock: Block = {
  slug: 'topicGrid',
  interfaceName: 'TopicGridBlock',
  labels: { singular: SECTION_NAMES.topicGrid!, plural: 'Topic tiles' },
  admin: { group: SECTION_GROUPS.stories },
  fields: [
    width,
    { ...title, defaultValue: 'തിരഞ്ഞെടുക്ക വിഷയങ്ങൾ', admin: { description: 'Section heading.' } },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      maxRows: 8,
      admin: {
        description:
          'Tiles show the category image, or its latest post image, and the article count. Leave empty to use the first topics automatically (video, audio and e-book shelves are skipped).',
      },
    },
    limit(4, 8),
  ],
}

export const CategoryGridBlock: Block = {
  slug: 'categoryGrid',
  interfaceName: 'CategoryGridBlock',
  labels: { singular: SECTION_NAMES.categoryGrid!, plural: 'Card grids' },
  admin: { group: SECTION_GROUPS.stories },
  fields: [
    width,
    category(),
    title,
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: ['2', '3', '4'],
      required: true,
    },
    limit(6),
    showMore,
  ],
}

export const CategoryListBlock: Block = {
  slug: 'categoryList',
  interfaceName: 'CategoryListBlock',
  labels: { singular: SECTION_NAMES.categoryList!, plural: 'Compact lists' },
  admin: { group: SECTION_GROUPS.stories },
  fields: [
    width,
    category(),
    title,
    limit(5, 10),
    { name: 'showThumbnails', type: 'checkbox', defaultValue: true },
    showMore,
  ],
}

export const MediaShelfBlock: Block = {
  slug: 'mediaShelf',
  interfaceName: 'MediaShelfBlock',
  labels: { singular: SECTION_NAMES.mediaShelf!, plural: 'Media sections' },
  admin: { group: SECTION_GROUPS.media },
  fields: [
    width,
    {
      name: 'format',
      type: 'select',
      required: true,
      defaultValue: 'video',
      options: [
        { label: 'Video', value: 'video' },
        { label: 'Audio', value: 'audio' },
        { label: 'E-book (PDF)', value: 'ebook' },
      ],
    },
    { ...category(false), admin: { description: 'Optional: limit to one category' } } as Field,
    title,
    limit(4, 60),
    {
      name: 'spotifyUrl',
      label: 'Spotify link',
      type: 'text',
      maxLength: 300,
      validate: validateSpotifyLink,
      admin: {
        condition: (_, sibling) => sibling?.format === 'audio',
        description:
          'Your Spotify show (Share → Copy link in Spotify). Every episode (up to 50) is listed in the card by themselves, first, in a list that scrolls, and a new episode appears within about 15 minutes of publishing it on Spotify, with nothing to upload here. It also adds the Spotify button. A playlist link only adds the button. Each audio post can also have its own Spotify link.',
      },
    },
  ],
}

export const QuickLinksBlock: Block = {
  slug: 'quickLinks',
  interfaceName: 'QuickLinksBlock',
  labels: { singular: SECTION_NAMES.quickLinks!, plural: 'Quick links' },
  admin: { group: SECTION_GROUPS.extras },
  fields: [
    { ...title, defaultValue: 'Quick Links' },
    { name: 'links', type: 'array', minRows: 1, maxRows: 20, fields: [linkGroup('link')] },
  ],
}

export const RichTextBlock: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: SECTION_NAMES.richText!, plural: 'Text' },
  admin: { group: SECTION_GROUPS.extras },
  fields: [
    width,
    title,
    { name: 'content', type: 'richText', editor: simpleEditor, required: true },
  ],
}

export const BannerBlock: Block = {
  slug: 'banner',
  interfaceName: 'BannerBlock',
  labels: { singular: SECTION_NAMES.banner!, plural: 'Banner images' },
  admin: { group: SECTION_GROUPS.promo },
  fields: [
    width,
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image' } },
    },
    linkGroup('link', { required: false }),
  ],
}

/**
 * The top ads banner as a section of its own: it is drawn where it sits in the layout, so it can be
 * moved (above Shorts, under the hero…) like any other section. The pictures themselves are set
 * under Ads banners → Top ads banner. With no such section in the layout the banner stays at the
 * very top of the page, as before.
 */
export const TopAdsBlock: Block = {
  slug: 'topAds',
  interfaceName: 'TopAdsBlock',
  labels: { singular: SECTION_NAMES.topAds!, plural: 'Top ads banner' },
  admin: { group: SECTION_GROUPS.promo },
  fields: [
    {
      name: 'picturesNote',
      type: 'ui',
      admin: { components: { Field: '/payload/admin/homepage/TopAdsNote#TopAdsNote' } },
    },
  ],
}

export const FollowUsBlock: Block = {
  slug: 'followUs',
  interfaceName: 'FollowUsBlock',
  labels: { singular: SECTION_NAMES.followUs!, plural: 'Follow us' },
  admin: { group: SECTION_GROUPS.extras },
  fields: [
    {
      ...title,
      defaultValue: 'Follow Us',
      admin: { description: 'Links come from Site settings → Social.' },
    },
  ],
}

export const QuickContactBlock: Block = {
  slug: 'quickContact',
  interfaceName: 'QuickContactBlock',
  labels: { singular: SECTION_NAMES.quickContact!, plural: 'Contact forms' },
  admin: { group: SECTION_GROUPS.extras },
  fields: [
    { ...title, defaultValue: 'Quick Contact' },
    { name: 'intro', type: 'textarea', maxLength: 300 },
  ],
}

/**
 * Every homepage section can be switched off without deleting it (and its settings), and gets the
 * one-line header (name · kind · Hidden) instead of Payload's type pill + block-name input.
 */
const hiddenField: Field = {
  name: 'hidden',
  type: 'checkbox',
  defaultValue: false,
  label: 'Hide this section',
  admin: { description: 'Keeps the settings but stops showing the section on the site.' },
}
const SECTION_LABEL = '/payload/admin/homepage/SectionLabel#SectionLabel'
const visible = new Map<Block, Block>()
const withHide = (blocks: Block[]): Block[] =>
  blocks.map((block) => {
    const wrapped = visible.get(block) ?? {
      ...block,
      admin: { ...block.admin, components: { ...block.admin?.components, Label: SECTION_LABEL } },
      fields: [hiddenField, ...block.fields],
    }
    visible.set(block, wrapped)
    return wrapped
  })

export const mainColumnBlocks: Block[] = withHide([
  FeaturedSliderBlock,
  CategoryFeatureBlock,
  TopicGridBlock,
  CategoryGridBlock,
  CategoryListBlock,
  MediaShelfBlock,
  RichTextBlock,
  BannerBlock,
  CallToActionBlock,
  FaqBlock,
  QuoteOfDayBlock,
  ReelsBlock,
  ShortsBlock,
  TopAdsBlock,
])
export const sidebarBlocks: Block[] = withHide([
  CategoryListBlock,
  QuickLinksBlock,
  QuickContactBlock,
  FollowUsBlock,
  BannerBlock,
  RichTextBlock,
  QuoteOfDayBlock,
  ReelsBlock,
  CallToActionBlock,
  FaqBlock,
])
