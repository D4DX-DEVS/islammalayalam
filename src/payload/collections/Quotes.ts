import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isAdmin, isEditor, publicActiveOrStaff, totpPublicRead } from '@/payload/access'
import { contentHooks } from '@/payload/hooks'

/**
 * Insights (the collection keeps its old "quotes" name so nothing stored has to move): a text, a
 * poster image, or both. The homepage sidebar slides through the first 5 in the order set in the
 * admin list (src/features/quotes/pick.ts), "View More" opens the full archive at /insights/ in
 * the same order, and each one has its own shareable page, /quote/<id>/.
 */
const TEXT_MAX = 600

/** The admin list shows this: the start of the text, else the source, else "Poster". */
const setLabel: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  // A partial update (a toggle, a script) carries only what it changes: the saved entry fills the rest.
  const merged = { ...originalDoc, ...data }
  const text = typeof merged.text === 'string' ? merged.text.replace(/\s+/g, ' ').trim() : ''
  const source = typeof merged.source === 'string' ? merged.source.trim() : ''
  const label = text ? (text.length > 80 ? `${text.slice(0, 79)}…` : text) : source || 'Poster'
  return { ...data, label }
}

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: { singular: 'Insight', plural: 'Insights' },
  admin: {
    useAsTitle: 'label',
    group: 'Library',
    defaultColumns: ['moveArrows', 'poster', 'label', 'showOn', 'active', 'createdAt'],
    listSearchableFields: ['label', 'text', 'source'],
    description:
      'Posters and thoughts for the homepage “Insights” slider (the first 5 in this list) and its “View More” archive. Drag the rows or use the arrows to set the order: the top one comes first.',
    components: {
      beforeListTable: ['/payload/admin/media/ListOrderHint#ListOrderHint'],
      edit: { SaveButton: '/payload/admin/media/SaveButtons#SaveButtons' },
    },
  },
  custom: totpPublicRead,
  // Position = order on the site and in the archive. Drag handles come from `orderable`; top row first.
  orderable: true,
  defaultSort: '-_order',
  access: { read: publicActiveOrStaff, create: isEditor, update: isEditor, delete: isAdmin },
  hooks: contentHooks({ beforeChange: [setLabel] }),
  fields: [
    {
      name: 'moveArrows',
      type: 'ui',
      label: 'Move',
      admin: {
        disableBulkEdit: true,
        components: { Cell: '/payload/admin/media/MoveArrows#MoveArrows' },
      },
    },
    { name: 'label', type: 'text', label: 'Name', admin: { hidden: true } },
    {
      name: 'poster',
      label: 'Poster image',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
      admin: {
        description:
          'Upload the poster here: a portrait image (4:5, e.g. 1080 × 1350) or a square one works best, and it is shown whole, never cropped. Without a poster, the text below is shown on a designed card.',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      maxLength: TEXT_MAX,
      admin: {
        description:
          'Optional when there is a poster. Sent along when someone shares it, and used as the poster’s description for screen readers.',
      },
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
      name: 'showOn',
      label: 'Show on',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
        description:
          'Optional. A future date keeps the insight hidden until that India day; leave empty to show it straight away.',
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
