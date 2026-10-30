import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  Field,
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
  seoField,
  sidebarSection,
  validateSpotifyLink,
} from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import {
  assignPostNumber,
  authorCannotPublish,
  derivePostFields,
  setCreatedBy,
} from '@/payload/hooks/editorial'
import { addEbookCategory } from '@/payload/hooks/ebook'
import { articleEditor, richTextHooks } from '@/payload/editor'
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
const validateDuration: TextFieldSingleValidation = (value) =>
  !value || /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(value)
    ? true
    : 'Use mm:ss or h:mm:ss, for example 18:24'
/** Optional length of a video or audio, shown as a badge on the site. */
const durationField: Field = {
  name: 'duration',
  type: 'text',
  maxLength: 8,
  validate: validateDuration,
  admin: {
    description: 'Optional length, e.g. 18:24 — shown on the video tile and next to audio tracks.',
  },
}

const setPublishedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const status = data?._status ?? originalDoc?._status
  if (status === 'published' && !data?.publishedAt && !originalDoc?.publishedAt)
    return { ...data, publishedAt: new Date().toISOString() }
  return data
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  // One collection for every kind of content (src/cms/content-types.ts): the sidebar offers each
  // kind as its own filtered list, and the list heading says "All content".
  labels: { singular: 'Post', plural: 'All content' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'postNumber', 'primaryCategory', '_status', 'publishedAt'],
    listSearchableFields: ['title', 'postNumber'],
    // Filter chips above the list (status and "needs review" are tabs); every other field is under
    // "Add filter". See src/payload/admin/lists/ListToolbar.tsx.
    custom: { listFilters: ['format', 'categories', 'author', 'featured', 'publishedAt'] },
  },
  custom: totpPublicRead,
  defaultSort: '-publishedAt',
  // validate: a new post is only written once "Save draft" (or Publish) is clicked with a title.
  // Without it Payload saves an empty "(untitled)" draft the moment the New post screen opens.
  versions: { drafts: { autosave: { interval: 3000 }, validate: true }, maxPerDoc: 30 },
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
      addEbookCategory,
      derivePostFields,
    ],
  }),
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 300 },
    {
      // Right under the title: the one choice that decides what else the post needs (a YouTube
      // link, a Spotify link, a PDF). Video and audio are only added this way.
      name: 'format',
      label: 'This post is',
      type: 'radio',
      defaultValue: 'standard',
      required: true,
      options: [
        { label: 'An article', value: 'standard' },
        { label: 'A video', value: 'video' },
        { label: 'An audio', value: 'audio' },
        { label: 'An e-book', value: 'ebook' },
      ],
      admin: {
        layout: 'horizontal',
        description: 'Video, audio and e-book posts get their link or PDF under Media & files.',
      },
    },
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
              admin: {
                description:
                  'For an e-book this is the book cover (a portrait image looks best on the shelf).',
              },
            },
            { name: 'content', type: 'richText', editor: articleEditor, hooks: richTextHooks },
          ],
        },
        {
          label: 'Media & files',
          fields: [
            {
              name: 'video',
              type: 'group',
              admin: { condition: (data) => data?.format === 'video' },
              fields: [
                { name: 'url', type: 'text', validate: validateVideo },
                durationField,
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
                  'Add a Spotify link (it plays inside the player on the site), or a link to hosted audio (https only). Audio uploads are not accepted. With both, the hosted audio plays and the Spotify link feeds the Spotify button.',
              },
              fields: [
                {
                  name: 'spotifyUrl',
                  label: 'Spotify link',
                  type: 'text',
                  maxLength: 300,
                  validate: validateSpotifyLink,
                  admin: {
                    description:
                      'Episode, show or playlist, e.g. https://open.spotify.com/episode/… (use Share → Copy link in Spotify).',
                  },
                },
                {
                  name: 'url',
                  label: 'Hosted audio link',
                  type: 'text',
                  validate: validateHttps,
                  admin: { description: 'Optional: a direct https link to an audio file.' },
                },
                durationField,
              ],
            },
            {
              name: 'ebook',
              label: 'E-book',
              type: 'group',
              admin: {
                condition: (data) => data?.format === 'ebook',
                description:
                  'Readers open the PDF as a page-turning book on the site and can download it. The cover is the Featured image (Content tab). E-books are listed under the E-Books category automatically.',
              },
              fields: [
                {
                  name: 'pdf',
                  label: 'Book PDF',
                  type: 'upload',
                  relationTo: 'media',
                  filterOptions: { mimeType: { equals: 'application/pdf' } },
                  admin: {
                    description:
                      'Upload or choose the book PDF (max 40 MB). Without one, the first PDF under "PDFs" below is used.',
                  },
                },
              ],
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
    // The right-hand column, as cards (presentational: field names and stored data are unchanged).
    sidebarSection('Publishing', [
      {
        name: 'publishedAt',
        label: 'Publish date',
        type: 'date',
        index: true,
        admin: {
          date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, h:mm a' },
          description: 'Set automatically when the post is first published.',
        },
      },
      { name: 'author', type: 'relationship', relationTo: 'authors' },
      {
        name: 'featured',
        label: 'Feature on the homepage',
        type: 'checkbox',
        defaultValue: false,
        index: true,
        admin: { description: 'Shows the post in the homepage slider.' },
        access: { create: editorFieldOnly, update: editorFieldOnly },
      },
      {
        name: 'postNumber',
        label: 'Post number',
        type: 'number',
        unique: true,
        index: true,
        admin: {
          readOnly: true,
          description: 'The post’s address on the site is /<number>/. Set automatically.',
        },
        access: { create: () => false, update: () => false },
      },
    ]),
    sidebarSection('Categories', [
      {
        name: 'categories',
        type: 'relationship',
        relationTo: 'categories',
        hasMany: true,
        index: true,
      },
      {
        name: 'primaryCategory',
        label: 'Main category',
        type: 'relationship',
        relationTo: 'categories',
        admin: { description: 'Shown on the post’s cards. Empty: the first category.' },
      },
    ]),
    reviewFlags,
    sidebarSection(
      'Details',
      [
        {
          name: 'readingMinutes',
          label: 'Reading time (minutes)',
          type: 'number',
          admin: { readOnly: true, description: 'Worked out from the text.' },
          access: { create: () => false, update: () => false },
        },
        createdByField,
        legacyFields({ withUrls: true }),
      ],
      { collapsed: true },
    ),
    searchTextField,
    searchKeyField,
    seoField({ title: 'the title', description: 'the excerpt', image: 'the featured image' }),
  ],
}
