import type { CollectionConfig } from 'payload'
import { isAdmin, isEditor, publicOrStaff, totpPublicRead } from '@/payload/access'
import { legacyFields, slugField } from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import { redirectOnSlugChange } from '@/payload/hooks/paths'

/** Topics, served at /category/<slug>/ (WordPress URL kept). */
export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'slug', 'order', 'updatedAt'],
  },
  custom: totpPublicRead,
  defaultSort: 'order',
  access: { read: publicOrStaff, create: isEditor, update: isEditor, delete: isAdmin },
  hooks: contentHooks({ afterChange: [redirectOnSlugChange('category')] }),
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    slugField('name'),
    { name: 'description', type: 'textarea', maxLength: 600 },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 100,
      admin: { position: 'sidebar', description: 'Lower numbers first' },
    },
    {
      name: 'hidden',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Placement-only category (e.g. the old "slider" flag): not listed publicly',
      },
    },
    legacyFields(),
  ],
}
