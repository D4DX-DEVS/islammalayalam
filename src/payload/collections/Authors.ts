import type { CollectionConfig } from 'payload'
import { isAdmin, isEditor, publicOrStaff, totpPublicRead } from '@/payload/access'
import { legacyFields, slugField } from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import { simpleEditor } from '@/payload/editor'

/**
 * Public bylines, served at /author/<slug>/. Kept separate from `users` so no login account,
 * email or role is ever exposed on the public site.
 */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: { useAsTitle: 'name', group: 'Content' },
  custom: totpPublicRead,
  access: { read: publicOrStaff, create: isEditor, update: isEditor, delete: isAdmin },
  hooks: contentHooks(),
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    slugField('name'),
    { name: 'bio', type: 'richText', editor: simpleEditor },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
    },
    legacyFields(),
  ],
}
