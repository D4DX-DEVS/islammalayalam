import type { Block, Field } from 'payload'
import { linkGroup } from '@/payload/fields'
import { youtubeId } from '@/lib/security/url'
import { shortsPage } from '@/lib/youtube-shorts'

/**
 * Engagement blocks from the client's revamp brief: quote of the day (flyer), reels
 * (സംശയനിവാരണം shorts), FAQ, and call-to-action cards (ഖുര്‍ആന്‍ ലളിതസാരം, Understanding Islam
 * course, Postal Library / Quran order). Rendered by src/components/home/EngageSections.tsx.
 */
const width: Field = {
  name: 'width',
  type: 'radio',
  defaultValue: 'full',
  options: [
    { label: 'Full width', value: 'full' },
    { label: 'Half (two consecutive half blocks sit side by side on desktop)', value: 'half' },
  ],
}
const heading = (defaultValue: string): Field => ({
  name: 'title',
  type: 'text',
  maxLength: 80,
  defaultValue,
})
const imageUpload = (name: string, description: string): Field => ({
  name,
  type: 'upload',
  relationTo: 'media',
  filterOptions: { mimeType: { contains: 'image' } },
  admin: { description },
})

export const QuoteOfDayBlock: Block = {
  slug: 'quoteOfDay',
  interfaceName: 'QuoteOfDayBlock',
  labels: { singular: 'Quote of the day', plural: 'Quote of the day' },
  fields: [
    heading('ഇന്നത്തെ ചിന്ത'),
    {
      name: 'quotes',
      type: 'array',
      minRows: 1,
      maxRows: 366,
      admin: {
        description:
          'One is shown per day (India time), cycling through the list. Add a flyer image, a text quote, or both.',
      },
      fields: [
        { name: 'text', type: 'textarea', maxLength: 600 },
        {
          name: 'source',
          type: 'text',
          maxLength: 120,
          admin: { description: 'e.g. ഖുര്‍ആന്‍ 2:286' },
        },
        imageUpload('flyer', 'Optional flyer image (square or portrait works best).'),
      ],
      validate: (rows: unknown) =>
        Array.isArray(rows) &&
        rows.every((r: { text?: string; flyer?: unknown }) => Boolean(r?.text?.trim() || r?.flyer))
          ? true
          : 'Each quote needs text or a flyer image',
    },
  ],
}

export const ReelsBlock: Block = {
  slug: 'reels',
  interfaceName: 'ReelsBlock',
  labels: { singular: 'Reels (YouTube Shorts)', plural: 'Reels' },
  fields: [
    heading('സംശയനിവാരണം'),
    {
      name: 'videos',
      type: 'array',
      minRows: 1,
      maxRows: 20,
      fields: [
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: { description: 'YouTube Shorts or video link' },
          validate: (value: unknown) =>
            typeof value === 'string' && youtubeId(value) ? true : 'Enter a YouTube link',
        },
        { name: 'title', type: 'text', required: true, maxLength: 140 },
      ],
    },
    linkGroup('moreLink', { required: false }),
  ],
}

export const ShortsBlock: Block = {
  slug: 'shorts',
  interfaceName: 'ShortsBlock',
  labels: { singular: 'YouTube Shorts (new ones appear by themselves)', plural: 'YouTube Shorts' },
  fields: [
    heading('Shorts'),
    {
      name: 'channel',
      type: 'text',
      required: true,
      defaultValue: '@Dialogue_Media',
      maxLength: 200,
      admin: {
        description:
          'The YouTube channel the Shorts come from: its @handle, or its address (youtube.com/@… or youtube.com/channel/UC…). Nothing to upload: a Short published on that channel shows here by itself within about 15 minutes.',
      },
      validate: (value: unknown) =>
        typeof value === 'string' && shortsPage(value)
          ? true
          : 'Enter a YouTube channel: @handle, or a youtube.com channel address',
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 12,
      min: 4,
      max: 24,
      required: true,
      label: 'How many Shorts to show',
    },
  ],
}

export const FaqBlock: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  labels: { singular: 'FAQ (questions & answers)', plural: 'FAQ' },
  fields: [
    width,
    heading('പൊതുവായ ചോദ്യങ്ങള്‍'),
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      maxRows: 30,
      fields: [
        { name: 'question', type: 'text', required: true, maxLength: 300 },
        { name: 'answer', type: 'textarea', required: true, maxLength: 3000 },
      ],
    },
    linkGroup('moreLink', { required: false }),
  ],
}

export const CallToActionBlock: Block = {
  slug: 'callToAction',
  interfaceName: 'CallToActionBlock',
  labels: { singular: 'Call to action / promo card', plural: 'Call to action cards' },
  fields: [
    width,
    {
      name: 'tone',
      type: 'select',
      defaultValue: 'brand',
      required: true,
      options: [
        { label: 'Blue', value: 'brand' },
        { label: 'Gold', value: 'gold' },
        { label: 'Deep navy', value: 'navy' },
        { label: 'Light', value: 'light' },
      ],
    },
    {
      name: 'eyebrow',
      type: 'text',
      maxLength: 60,
      admin: { description: 'Small label above the heading, e.g. "Online course"' },
    },
    { name: 'heading', type: 'text', required: true, maxLength: 120 },
    { name: 'text', type: 'textarea', maxLength: 600 },
    imageUpload('image', 'Optional banner / cover image shown beside the text.'),
    {
      name: 'details',
      type: 'array',
      maxRows: 6,
      admin: { description: 'Optional facts, e.g. Duration · 8 weeks, Mode · Online, Fee · Free' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, maxLength: 40 },
            { name: 'value', type: 'text', required: true, maxLength: 80 },
          ],
        },
      ],
    },
    {
      name: 'buttons',
      type: 'array',
      maxRows: 3,
      fields: [
        linkGroup('link'),
        {
          name: 'style',
          type: 'radio',
          defaultValue: 'primary',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
          ],
          admin: { layout: 'horizontal' },
        },
      ],
    },
  ],
}
