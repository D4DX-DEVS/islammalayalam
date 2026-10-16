import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isAdmin, isEditor, publicActiveOrStaff, totpPublicRead } from '@/payload/access'
import { contentHooks } from '@/payload/hooks'

/**
 * Daily quotes: a text, a poster image, or both. The homepage shows one per day in its sidebar
 * (src/features/quotes/pick.ts): the quote scheduled for today, otherwise the undated ones in
 * rotation. Each quote also has its own shareable page, /quote/<id>/.
 */
const TEXT_MAX = 600

/** The admin list shows this: the start of the text, else the source, else "Poster". */
const setLabel: CollectionBeforeChangeHook = ({ data }) => {
  const text = typeof data?.text === 'string' ? data.text.replace(/\s+/g, ' ').trim() : ''
  const source = typeof data?.source === 'string' ? data.source.trim() : ''
  const label = text ? (text.length > 80 ? `${text.slice(0, 79)}…` : text) : source || 'Poster'
  return { ...data, label }
}

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: { singular: 'Quote', plural: 'Quotes' },
  admin: {
    useAsTitle: 'label',
    group: 'Content',
    defaultColumns: ['label', 'showOn', 'active', 'updatedAt'],
    listSearchableFields: ['label', 'text', 'source'],
    description:
      'The homepage shows one quote a day. A quote with a “Show on” date appears that day; quotes without a date take turns, one per day.',
  },
  custom: totpPublicRead,
  defaultSort: '-createdAt',
  access: { read: publicActiveOrStaff, create: isEditor, update: isEditor, delete: isAdmin },
  hooks: contentHooks({ beforeChange: [setLabel] }),
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    {
      name: 'text',
      type: 'textarea',
      maxLength: TEXT_MAX,
      admin: { description: 'The quote itself. Used for sharing and as the poster’s description.' },
      validate: (value, { siblingData }) =>
        (typeof value === 'string' && value.trim()) ||
        (siblingData as { poster?: unknown } | undefined)?.poster
          ? true
          : 'Add the quote text, a poster image, or both',
    },
    {
      name: 'source',
      type: 'text',
      maxLength: 120,
      admin: { description: 'Who said it or where it is from, e.g. ഖുര്‍ആന്‍ 2:286.' },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
      admin: {
        description:
          'Optional poster image (square or portrait works best). Without one, the text is shown on a designed card.',
      },
    },
    {
      name: 'showOn',
      label: 'Show on',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
        description: 'India date. Leave empty to put the quote in the daily rotation.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Untick to hide it without deleting.' },
    },
  ],
}
