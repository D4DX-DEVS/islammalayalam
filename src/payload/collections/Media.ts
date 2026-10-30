import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { isEditor, isStaff, publicOrStaff, totpPublicRead } from '@/payload/access'
import { legacyFields } from '@/payload/fields'
import { auditCollectionChange, auditCollectionDelete } from '@/payload/hooks/auditLog'
import { guardCollectionContent } from '@/payload/hooks/contentGuard'
import {
  guardMediaUpload,
  recordMediaFacts,
  rejectFilelessCreate,
} from '@/payload/hooks/mediaGuard'
import { revalidateCollection, revalidateCollectionDelete } from '@/payload/hooks/revalidate'
import { ALLOWED_MIME_TYPES, altFromFilename } from '@/lib/media/file-policy'

const MEDIA_DIR = /^[a-z0-9][a-z0-9._-]*$/i

/** Local upload folder: `.test-media` in tests, `MEDIA_DIR` (plain folder name) if set, else `media`. */
export function mediaDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === 'test') return '.test-media'
  return env.MEDIA_DIR && MEDIA_DIR.test(env.MEDIA_DIR) ? env.MEDIA_DIR : 'media'
}

/**
 * An image saved without a description gets its file name as one instead of failing: the upload
 * form cannot flag the empty field before the file reaches the server, so editors only saw a save
 * error (e.g. when adding an ad banner with "Create New"). Runs before validation, after Payload has
 * read the file's type.
 */
const defaultImageAlt: CollectionBeforeValidateHook = ({ data, originalDoc, req }) => {
  if (!data || req.context?.migration) return data
  const mimeType = data.mimeType ?? originalDoc?.mimeType
  const alt = data.alt ?? originalDoc?.alt
  if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) return data
  if (typeof alt === 'string' && alt.trim()) return data
  return { ...data, alt: altFromFilename(data.filename ?? originalDoc?.filename) }
}

/**
 * Media library. Every file passes the media guard (magic bytes, re-encode, PDF scan) before
 * Payload stores it. With DO_SPACES_* set (locally and in production) the S3 adapter stores them in
 * DO Spaces (payload.config.ts); without, files live in ./media. The original keeps its (re-encoded) format; four WebP renditions
 * are generated — the WordPress site had 20+ theme sizes per image, none of which are needed.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'File', plural: 'Files and images' },
  admin: {
    group: 'Library',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'],
  },
  custom: totpPublicRead,
  // Duplicating would create a document without a fresh guarded upload (see rejectFilelessCreate).
  disableDuplicate: true,
  access: {
    read: publicOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isEditor,
  },
  upload: {
    // Tests and the local migration preview write to their own folders, never to development uploads.
    staticDir: mediaDir(),
    mimeTypes: ALLOWED_MIME_TYPES,
    filesRequiredOnCreate: true,
    pasteURL: false,
    focalPoint: true,
    crop: false,
    bulkUpload: true,
    adminThumbnail: 'thumb',
    imageSizes: [
      {
        name: 'thumb',
        width: 320,
        height: 240,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 75 } },
      },
      {
        name: 'card',
        width: 640,
        height: 400,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
      {
        name: 'medium',
        width: 1024,
        formatOptions: { format: 'webp', options: { quality: 80 } },
        withoutEnlargement: true,
      },
      {
        name: 'large',
        width: 1600,
        formatOptions: { format: 'webp', options: { quality: 80 } },
        withoutEnlargement: true,
      },
    ],
  },
  hooks: {
    beforeOperation: [guardMediaUpload],
    beforeValidate: [guardCollectionContent, defaultImageAlt],
    beforeChange: [rejectFilelessCreate, recordMediaFacts],
    afterChange: [revalidateCollection, auditCollectionChange],
    afterDelete: [revalidateCollectionDelete, auditCollectionDelete],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      maxLength: 300,
      admin: {
        description:
          'Describe the image for screen readers. Left empty, the file name is used — replace it with a real description.',
      },
      validate: (
        value: string | null | undefined,
        {
          data,
          req,
        }: { data: Partial<Record<string, unknown>>; req: { context: Record<string, unknown> } },
      ) => {
        if (req.context?.migration) return true // audit: 607/612 legacy images have no alt → flagged for review instead
        const isImage = typeof data?.mimeType === 'string' && data.mimeType.startsWith('image/')
        return !isImage || (value && value.trim().length > 0)
          ? true
          : 'Alt text is required for images'
      },
    },
    { name: 'caption', type: 'text', maxLength: 300 },
    { name: 'credit', type: 'text', maxLength: 160 },
    {
      name: 'blurDataURL',
      type: 'text',
      admin: { hidden: true, disableListColumn: true, disableListFilter: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'sourceSha256',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'SHA-256 of the original upload (dedupe)',
        disableListColumn: true,
        disableListFilter: true,
      },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'security',
      type: 'group',
      admin: { position: 'sidebar', readOnly: true },
      access: { create: () => false, update: () => false, read: ({ req }) => Boolean(req.user) },
      fields: [
        { name: 'kind', type: 'text' },
        { name: 'reencoded', type: 'checkbox' },
        { name: 'scannedAt', type: 'date' },
      ],
    },
    legacyFields({ withUrls: true }),
  ],
}
