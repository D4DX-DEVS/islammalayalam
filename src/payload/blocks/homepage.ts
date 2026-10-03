import type { Block, Field } from 'payload'
import { linkGroup } from '@/payload/fields'
import { simpleEditor } from '@/payload/editor'

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
  labels: { singular: 'Hero: featured stories', plural: 'Hero blocks' },
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
  ],
}

export const CategoryFeatureBlock: Block = {
  slug: 'categoryFeature',
  interfaceName: 'CategoryFeatureBlock',
  labels: { singular: 'Category: lead + list', plural: 'Category: lead + list' },
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

export const CategoryGridBlock: Block = {
  slug: 'categoryGrid',
  interfaceName: 'CategoryGridBlock',
  labels: { singular: 'Category: card grid', plural: 'Category: card grids' },
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
  labels: { singular: 'Category: compact list', plural: 'Category: compact lists' },
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
  labels: { singular: 'Media: videos / audios / e-books', plural: 'Media sections' },
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
    limit(4),
  ],
}

export const QuickLinksBlock: Block = {
  slug: 'quickLinks',
  interfaceName: 'QuickLinksBlock',
  labels: { singular: 'Quick links', plural: 'Quick links' },
  fields: [
    { ...title, defaultValue: 'Quick Links' },
    { name: 'links', type: 'array', minRows: 1, maxRows: 20, fields: [linkGroup('link')] },
  ],
}

export const RichTextBlock: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Text', plural: 'Text' },
  fields: [
    width,
    title,
    { name: 'content', type: 'richText', editor: simpleEditor, required: true },
  ],
}

export const BannerBlock: Block = {
  slug: 'banner',
  interfaceName: 'BannerBlock',
  labels: { singular: 'Banner image', plural: 'Banner images' },
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

export const FollowUsBlock: Block = {
  slug: 'followUs',
  interfaceName: 'FollowUsBlock',
  labels: { singular: 'Follow us (social links)', plural: 'Follow us' },
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
  labels: { singular: 'Quick contact form', plural: 'Quick contact forms' },
  fields: [
    { ...title, defaultValue: 'Quick Contact' },
    { name: 'intro', type: 'textarea', maxLength: 300 },
  ],
}

export const mainColumnBlocks: Block[] = [
  FeaturedSliderBlock,
  CategoryFeatureBlock,
  CategoryGridBlock,
  CategoryListBlock,
  MediaShelfBlock,
  RichTextBlock,
  BannerBlock,
]
export const sidebarBlocks: Block[] = [
  CategoryListBlock,
  QuickLinksBlock,
  QuickContactBlock,
  FollowUsBlock,
  BannerBlock,
  RichTextBlock,
]
