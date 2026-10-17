import type { Field, GlobalConfig, TextFieldSingleValidation } from 'payload'
import { isAdmin, isEditor, totpPublicRead } from '@/payload/access'
import { linkGroup } from '@/payload/fields'
import { mainColumnBlocks, sidebarBlocks } from '@/payload/blocks/homepage'
import { auditGlobalChange } from '@/payload/hooks/auditLog'
import { guardGlobalContent } from '@/payload/hooks/contentGuard'
import { revalidateGlobal } from '@/payload/hooks/revalidate'
import { applyMfaSetting, SECURITY_SETTINGS } from '@/payload/mfa'

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
      fields: ['facebook', 'x', 'instagram', 'youtube', 'whatsapp', 'telegram', 'spotify'].map(
        (name): Field => ({ name, type: 'text', validate: httpsOnly }),
      ),
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text', maxLength: 40 },
        {
          name: 'whatsappNumber',
          type: 'text',
          maxLength: 24,
          label: 'WhatsApp number',
          validate: (value: string | null | undefined) =>
            !value || /^\+?[\d\s()-]{8,20}$/.test(value)
              ? true
              : 'Enter the number with country code, e.g. +91 98765 43210',
          admin: {
            description:
              'Shows a green “chat on WhatsApp” button at the bottom right of every page. Leave empty to hide it.',
          },
        },
        {
          name: 'whatsappMessage',
          type: 'text',
          maxLength: 200,
          label: 'WhatsApp greeting',
          defaultValue: 'അസ്സലാമു അലൈക്കും',
          admin: {
            description:
              'The message that is ready in the chat box when a visitor taps the button.',
          },
        },
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
      fields: [
        linkGroup('link'),
        {
          name: 'highlight',
          type: 'checkbox',
          label: 'Show as a highlighted button (e.g. Postal Library, Order the Quran)',
        },
      ],
    },
    {
      name: 'showSocialInTopBar',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show social icons in the header (desktop)',
    },
    {
      name: 'topBanner',
      label: 'Top banner',
      type: 'group',
      admin: {
        description:
          'A full-width image banner right below the menu bar, on every page, with an optional link. With no image, nothing is shown.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          filterOptions: { mimeType: { contains: 'image' } },
          admin: {
            description:
              'Wide image — 1920 × 240 or larger looks sharp on every screen (the banner is shown edge to edge).',
          },
        },
        {
          name: 'mobileImage',
          label: 'Image for phones (optional)',
          type: 'upload',
          relationTo: 'media',
          filterOptions: { mimeType: { contains: 'image' } },
          admin: {
            description:
              'A narrower version, e.g. 900 × 360, used on screens under 640 px wide. Without one, the main image is scaled down.',
          },
        },
        linkGroup('link', { required: false }),
        {
          name: 'hidden',
          type: 'checkbox',
          defaultValue: false,
          label: 'Hide the top banner',
          admin: { description: 'Keeps the settings but stops showing the banner on the site.' },
        },
      ],
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

/** Admin-only sign-in policy (src/payload/mfa.ts). Not public: it is never rendered on the site. */
export const SecuritySettings: GlobalConfig = {
  slug: SECURITY_SETTINGS,
  label: 'Security',
  admin: {
    group: 'Settings',
    // One self-saving switch (TwoStepSwitch) with its own confirmation: no Save button.
    components: { elements: { SaveButton: '/payload/admin/mfa/NoSaveButton#NoSaveButton' } },
  },
  access: { read: isAdmin, update: isAdmin },
  hooks: { afterChange: [applyMfaSetting, auditGlobalChange] },
  fields: [
    {
      name: 'requireTwoFactor',
      type: 'checkbox',
      label: 'Two-step verification (authenticator app) at sign-in',
      defaultValue: true,
      admin: { components: { Field: '/payload/admin/mfa/TwoStepSwitch#TwoStepSwitch' } },
    },
  ],
}

export const globals: GlobalConfig[] = [SiteSettings, Header, Homepage, Footer, SecuritySettings]
