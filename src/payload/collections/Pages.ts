import type { CollectionConfig } from 'payload'
import { isAdmin, isEditor, publicOrStaff, totpPublicRead } from '@/payload/access'
import {
  createdByField,
  legacyFields,
  reviewFlags,
  searchKeyField,
  searchTextField,
  slugField,
} from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import { derivePageFields, setCreatedBy } from '@/payload/hooks/editorial'
import { cascadePagePath, computePagePath } from '@/payload/hooks/paths'
import { articleEditor, simpleEditor } from '@/payload/editor'

/**
 * Knowledge-base tree and static pages, served at their hierarchical path (/kb/salah/wudu/).
 * WordPress rendered these with WPBakery shortcode tabs (Qur'an verses / Hadith); here those tabs
 * are real `sections`. Pages keep version history but no drafts: a re-save of a child during a
 * path cascade must never publish someone's unfinished draft.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'path', 'kind', 'updatedAt'],
    listSearchableFields: ['title', 'path'],
  },
  custom: totpPublicRead,
  defaultSort: 'order',
  versions: { maxPerDoc: 25 },
  access: {
    read: publicOrStaff,
    readVersions: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isAdmin,
  },
  hooks: contentHooks({
    beforeChange: [setCreatedBy, computePagePath, derivePageFields],
    afterChange: [cascadePagePath],
  }),
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 300 },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'kb',
      required: true,
      options: [
        { label: 'Knowledge base', value: 'kb' },
        { label: 'Static page', value: 'static' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'intro', type: 'richText', editor: simpleEditor },
    { name: 'content', type: 'richText', editor: articleEditor },
    {
      name: 'sections',
      type: 'array',
      maxRows: 12,
      admin: { description: 'Shown as tabs (e.g. ഖുര്‍ആന്‍ സൂക്തങ്ങള്‍ / നബി വചനങ്ങള്‍)' },
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 120 },
        { name: 'content', type: 'richText', editor: articleEditor },
      ],
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
    },
    slugField('title', { unique: false }),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'pages',
      admin: { position: 'sidebar' },
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
    },
    {
      name: 'path',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Computed from parent + slug' },
      access: { create: () => false, update: () => false },
    },
    { name: 'order', type: 'number', defaultValue: 100, admin: { position: 'sidebar' } },
    reviewFlags,
    createdByField,
    searchTextField,
    searchKeyField,
    legacyFields({ withUrls: true }),
  ],
}
