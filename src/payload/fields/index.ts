import type { Field, FieldHook, TextFieldSingleValidation } from 'payload'
import { normalizeSlug } from '@/lib/text/slug'
import { isSafeHref } from '@/lib/security/url'
import { staffFieldOnly } from '@/payload/access'

/** Slug: NFC, zero-width-free, Malayalam-safe. Derived from `source` when left empty. */
export function slugField(source = 'title', opts: { unique?: boolean } = {}): Field {
  const formatSlug: FieldHook = ({ value, data, originalDoc }) => {
    const raw =
      (typeof value === 'string' && value.trim()) || data?.[source] || originalDoc?.[source] || ''
    return normalizeSlug(String(raw))
  }
  return {
    name: 'slug',
    type: 'text',
    index: true,
    unique: opts.unique ?? true,
    required: true,
    admin: {
      position: 'sidebar',
      description:
        'URL segment. Normalised automatically (Malayalam-safe, no invisible characters).',
    },
    hooks: { beforeValidate: [formatSlug] },
    validate: ((value) =>
      value && normalizeSlug(value) === value
        ? true
        : 'Slug is empty or not normalised') as TextFieldSingleValidation,
  }
}

/** Read-only references back to WordPress, written only by the migration (Local API, overrideAccess). */
export function legacyFields(opts: { withUrls?: boolean } = {}): Field {
  return {
    name: 'legacy',
    type: 'group',
    label: 'Legacy WordPress reference',
    admin: {
      position: 'sidebar',
      readOnly: true,
      condition: (data) => Boolean(data?.legacy?.wpId),
    },
    access: { read: staffFieldOnly, create: () => false, update: () => false },
    fields: [
      { name: 'wpId', type: 'number', index: true, admin: { readOnly: true } },
      { name: 'legacySlugs', type: 'text', hasMany: true, admin: { readOnly: true } },
      ...(opts.withUrls
        ? [
            {
              name: 'legacyUrls',
              type: 'text',
              hasMany: true,
              index: true,
              admin: { readOnly: true },
            } as Field,
          ]
        : []),
      {
        name: 'sourceHash',
        type: 'text',
        admin: {
          readOnly: true,
          description: 'Hash of the sanitized source record (idempotent re-runs)',
        },
      },
      { name: 'migratedAt', type: 'date', admin: { readOnly: true } },
    ],
  }
}

/** Review flags raised by the migration (audit: tampered dates, empty titles). Editors clear them. */
export const reviewFlags: Field = {
  name: 'flags',
  type: 'group',
  access: { read: staffFieldOnly },
  admin: { position: 'sidebar' },
  fields: [
    { name: 'needsReview', type: 'checkbox', defaultValue: false, index: true },
    {
      name: 'titleDerived',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Title was generated from the text (WordPress title was empty)' },
    },
    {
      name: 'dateSuspect',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Publish date looked tampered/invalid in WordPress' },
    },
    { name: 'reviewNote', type: 'textarea', maxLength: 1000 },
  ],
}

/** Who created the document (drives author-level access). Set by hook, never by clients. */
export const createdByField: Field = {
  name: 'createdBy',
  type: 'relationship',
  relationTo: 'users',
  index: true,
  access: { read: staffFieldOnly, create: () => false, update: () => false },
  admin: { position: 'sidebar', readOnly: true },
}

/** Longest stored search text; above Payload's 40 000-character default, so it is set explicitly. */
export const SEARCH_TEXT_LIMIT = 60_000

/** Hidden derived plain text used for site search (computed in hooks). */
export const searchTextField: Field = {
  name: 'searchText',
  type: 'textarea',
  maxLength: SEARCH_TEXT_LIMIT,
  admin: { hidden: true },
  access: { create: () => false, update: () => false, read: () => false },
}

/** Normalised title + summary for site search (see src/lib/text/search.ts). Server-computed, never exposed. */
export const searchKeyField: Field = {
  name: 'searchKey',
  type: 'textarea',
  admin: { hidden: true },
  access: { create: () => false, update: () => false, read: () => false },
}

const validateHref: TextFieldSingleValidation = (value, { siblingData }) => {
  const type = (siblingData as { type?: string } | undefined)?.type
  if (type === 'custom' && !value) return 'URL is required'
  return !value || isSafeHref(value)
    ? true
    : 'Only site paths (/…), https://, mailto: or tel: links are allowed'
}

/** Link used by menus and homepage blocks: internal document, category, or safe URL. */
export function linkGroup(name = 'link', opts: { required?: boolean } = {}): Field {
  return {
    name,
    type: 'group',
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'type',
            type: 'radio',
            defaultValue: 'reference',
            options: [
              { label: 'Page / post / category', value: 'reference' },
              { label: 'URL', value: 'custom' },
              { label: 'No link (label only)', value: 'none' },
            ],
            admin: { layout: 'horizontal' },
          },
          { name: 'newTab', type: 'checkbox', label: 'Open in new tab', admin: { width: '30%' } },
        ],
      },
      { name: 'label', type: 'text', required: opts.required ?? true, maxLength: 120 },
      {
        name: 'reference',
        type: 'relationship',
        relationTo: ['pages', 'posts', 'categories'],
        admin: { condition: (_, sibling) => sibling?.type === 'reference' },
        validate: ((value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
          siblingData?.type !== 'reference' || value
            ? true
            : 'Choose a page, post or category') as never,
      },
      {
        name: 'url',
        type: 'text',
        admin: { condition: (_, sibling) => sibling?.type === 'custom' },
        validate: validateHref,
      },
    ],
  }
}
