import type { Field, GlobalConfig, TextFieldSingleValidation } from 'payload'
import { isAdmin, isEditor, totpPublicRead } from '@/payload/access'
import { linkGroup } from '@/payload/fields'
import { mainColumnBlocks, sidebarBlocks } from '@/payload/blocks/homepage'
import { auditGlobalChange } from '@/payload/hooks/auditLog'
import { guardGlobalContent } from '@/payload/hooks/contentGuard'
import { revalidateGlobal } from '@/payload/hooks/revalidate'

/**
 * Site-wide, editor-controlled globals: settings, header (top bar + 3-level menu), homepage
 * layout, footer. Public read (rendered on every page); writes are guarded, audited, revalidated.
 */
const hooks: GlobalConfig['hooks'] = {
  beforeValidate: [guardGlobalContent],
  afterChange: [revalidateGlobal, auditGlobalChange],
}
const publicRead = () => true
const httpsOnly: TextFieldSingleValidation = (v) =>
  !v || /^https:\/\/[^\s]+$/.test(v) ? true : 'Only https:// links'
const imageUpload = (name: string, description?: string): Field => ({
  name,
  type: 'upload',
  relationTo: 'media',
  filterOptions: { mimeType: { contains: 'image' } },
  admin: description ? { description } : undefined,
})

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Settings' },
  custom: totpPublicRead,
  access: { read: publicRead, update: isAdmin },
  hooks,
  fields: [
    { name: 'siteName', type: 'text', required: true, defaultValue: 'Islam Malayalam' },
    { name: 'siteNameMl', type: 'text', defaultValue: 'ഇസ്‌ലാം മലയാളം' },
    { name: 'tagline', type: 'text', maxLength: 200 },
    imageUpload('logo', 'Main logo (left)'),
    imageUpload('partnerLogo', 'Partner logo (right), e.g. Dialogue Centre Kerala'),
    { name: 'partnerUrl', type: 'text', validate: httpsOnly },
    imageUpload('defaultOgImage', 'Fallback social-share image (1200×630)'),
    {
      name: 'social',
      type: 'group',
      fields: ['facebook', 'x', 'instagram', 'youtube', 'whatsapp', 'telegram'].map(
        (name): Field => ({ name, type: 'text', validate: httpsOnly }),
      ),
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text', maxLength: 40 },
        { name: 'address', type: 'textarea', maxLength: 400 },
      ],
    },
  ],
}

const menuItem = (children?: Field): Field[] => [linkGroup('link'), ...(children ? [children] : [])]

export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Header & menu',
  admin: { group: 'Settings' },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      name: 'topBarLinks',
      type: 'array',
      maxRows: 6,
      label: 'Header links',
      admin: {
        description:
          'Small links beside the logo on desktop and at the bottom of the mobile menu (e.g. About Us · Postal Library).',
      },
      fields: [linkGroup('link')],
    },
    {
      name: 'showSocialInTopBar',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show social icons in the header (desktop)',
    },
    {
      name: 'mainMenu',
      type: 'array',
      maxRows: 14,
      admin: { description: 'Blue navigation bar. Up to three levels.' },
      fields: menuItem({
        name: 'children',
        type: 'array',
        maxRows: 40,
        fields: menuItem({ name: 'children', type: 'array', maxRows: 40, fields: menuItem() }),
      }),
    },
  ],
}

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  admin: { group: 'Settings' },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      name: 'layout',
      type: 'blocks',
      blocks: mainColumnBlocks,
      maxRows: 30,
      admin: { description: 'Main column, top to bottom' },
    },
    {
      name: 'sidebar',
      type: 'blocks',
      blocks: sidebarBlocks,
      maxRows: 15,
      admin: { description: 'Right sidebar on desktop; shown after the main column on mobile' },
    },
  ],
}

export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Footer',
  admin: { group: 'Settings' },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      name: 'columns',
      type: 'array',
      maxRows: 4,
      admin: {
        description: 'Dark footer columns (original: Quick Links · Quick Contact · Follow Us)',
      },
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 80 },
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'links',
          options: [
            { label: 'Links', value: 'links' },
            { label: 'Contact details (from Site settings)', value: 'contact' },
            { label: 'Social links (from Site settings)', value: 'social' },
            { label: 'Text', value: 'text' },
          ],
        },
        {
          name: 'links',
          type: 'array',
          maxRows: 12,
          fields: [linkGroup('link')],
          admin: { condition: (_, s) => s?.kind === 'links' },
        },
        {
          name: 'text',
          type: 'textarea',
          maxLength: 600,
          admin: { condition: (_, s) => s?.kind === 'text' },
        },
      ],
    },
    { name: 'bottomLinks', type: 'array', maxRows: 6, fields: [linkGroup('link')] },
    {
      name: 'copyright',
      type: 'text',
      maxLength: 200,
      defaultValue: '© Islam Malayalam. All rights reserved.',
    },
  ],
}

export const globals: GlobalConfig[] = [SiteSettings, Header, Homepage, Footer]
