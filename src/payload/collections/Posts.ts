import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  TextFieldSingleValidation,
} from 'payload'
import {
  editorFieldOnly,
  editorOrOwnDoc,
  isEditor,
  isStaff,
  publishedOrStaff,
  totpPublicRead,
  versionsOfOwnOrEditor,
} from '@/payload/access'
import {
  createdByField,
  legacyFields,
  reviewFlags,
  searchKeyField,
  searchTextField,
} from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import {
  assignPostNumber,
  authorCannotPublish,
  derivePostFields,
  setCreatedBy,
} from '@/payload/hooks/editorial'
import { articleEditor } from '@/payload/editor'
import { isSafeHref, youtubeId } from '@/lib/security/url'

/**
 * Articles, Q&A, news, audio/video posts and e-books. Public URL: /<postNumber>/ — identical to the
 * WordPress permalink (/{id}/), so every indexed link keeps working.
 */
const validateHttps: TextFieldSingleValidation = (value) =>
  !value || (isSafeHref(value) && value.startsWith('https://'))
    ? true
    : 'Only https:// links are allowed'
const validateVideo: TextFieldSingleValidation = (value) =>
  !value || youtubeId(value) ? true : 'Enter a YouTube link'

const setPublishedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const status = data?._status ?? originalDoc?._status
  if (status === 'published' && !data?.publishedAt && !originalDoc?.publishedAt)
    return { ...data, publishedAt: new Date().toISOString() }
  return data
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'postNumber', 'primaryCategory', '_status', 'publishedAt'],
    listSearchableFields: ['title', 'postNumber'],
  },
  custom: totpPublicRead,
  defaultSort: '-publishedAt',
  versions: { drafts: { autosave: { interval: 3000 } }, maxPerDoc: 30 },
  access: {
    read: publishedOrStaff,
    readVersions: versionsOfOwnOrEditor,
    create: isStaff,
    update: editorOrOwnDoc,
    delete: isEditor,
  },
  indexes: [
    { fields: ['_status', 'publishedAt'] },
    { fields: ['categories', '_status', 'publishedAt'] },
  ],
  hooks: contentHooks({
    beforeChange: [
      setCreatedBy,
      authorCannotPublish,
      assignPostNumber,
      setPublishedAt,
      derivePostFields,
    ],
  }),
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 300 },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'excerpt',
              type: 'textarea',
              maxLength: 600,
              admin: { description: 'Short summary for cards and search results' },
            },
            {
              name: 'featuredImage',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { contains: 'image' } },
            },
            { name: 'content', type: 'richText', editor: articleEditor },
          ],
        },
        {
          label: 'Media & files',
          fields: [
            {
              name: 'format',
              type: 'select',
              defaultValue: 'standard',
              required: true,
              options: [
                { label: 'Standard', value: 'standard' },
                { label: 'Video', value: 'video' },
                { label: 'Audio', value: 'audio' },
                { label: 'E-book', value: 'ebook' },
              ],
            },
            {
              name: 'video',
              type: 'group',
              admin: { condition: (data) => data?.format === 'video' },
              fields: [
                { name: 'url', type: 'text', validate: validateVideo },
                {
                  name: 'youtubeId',
                  type: 'text',
                  admin: { readOnly: true },
                  access: { create: () => false, update: () => false },
                },
              ],
            },
            {
              name: 'audio',
              type: 'group',
              admin: {
                condition: (data) => data?.format === 'audio',
                description:
                  'Link to the hosted audio (https only). Audio uploads are not accepted.',
              },
              fields: [{ name: 'url', type: 'text', validate: validateHttps }],
            },
            {
              name: 'attachments',
              type: 'array',
              maxRows: 20,
              labels: { singular: 'PDF', plural: 'PDFs' },
              fields: [
                {
                  name: 'file',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                  filterOptions: { mimeType: { equals: 'application/pdf' } },
                },
                { name: 'label', type: 'text', maxLength: 160 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'postNumber',
      type: 'number',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Public URL: /<number>/. Assigned automatically.',
      },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'publishedAt',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'primaryCategory',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar', description: 'Defaults to the first category' },
    },
    { name: 'author', type: 'relationship', relationTo: 'authors', admin: { position: 'sidebar' } },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Show in the homepage slider' },
      access: { create: editorFieldOnly, update: editorFieldOnly },
    },
    {
      name: 'readingMinutes',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true },
      access: { create: () => false, update: () => false },
    },
    reviewFlags,
    createdByField,
    searchTextField,
    searchKeyField,
    legacyFields({ withUrls: true }),
  ],
}
