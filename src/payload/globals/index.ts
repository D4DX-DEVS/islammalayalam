import type { Field, GlobalConfig, TextFieldSingleValidation } from 'payload'
import { isAdmin, isEditor, totpPublicRead } from '@/payload/access'
import { linkGroup, validateAdLink } from '@/payload/fields'
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
  admin: { group: 'Site' },
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
        {
          name: 'secondEmail',
          type: 'email',
          label: 'Second email',
          admin: {
            description:
              'Optional. Listed under the first email wherever the contact details appear (footer, Quick Contact, the About page).',
          },
        },
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
  label: 'Header and menu',
  admin: { group: 'Site' },
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

/** One row of the Ads banners lists. `phone` adds a narrower picture for small screens. */
const adRows = (opts: {
  name: string
  label: string
  phone: boolean
  max: number
  help: string
}): Field => ({
  name: opts.name,
  type: 'array',
  maxRows: opts.max,
  labels: { singular: 'Banner', plural: 'Banners' },
  admin: {
    description: opts.help,
    initCollapsed: false,
    components: { RowLabel: '/payload/admin/ads/BannerRowLabel#BannerRowLabel' },
  },
  fields: [
    {
      name: 'image',
      label: 'Banner image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image' } },
      admin: {
        description:
          'Shown whole, never cropped. Upload it at 2× the size it appears for a sharp result.',
      },
    },
    ...(opts.phone
      ? [
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
          } satisfies Field,
        ]
      : []),
    {
      name: 'url',
      label: 'Link (URL)',
      type: 'text',
      maxLength: 500,
      validate: validateAdLink,
      admin: {
        placeholder: 'https://example.com/',
        description:
          'Where a click goes: a web address (https://…) or a page of this site (/about-us/). Leave empty for a banner that is not clickable.',
      },
    },
    {
      name: 'openIn',
      label: 'Open the link in',
      type: 'radio',
      defaultValue: 'new',
      options: [
        { label: 'New tab', value: 'new' },
        { label: 'Same window', value: 'same' },
      ],
      admin: { layout: 'horizontal', condition: (_, sibling) => Boolean(sibling?.url) },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: 'Name (only for you)',
          type: 'text',
          maxLength: 80,
          admin: { description: 'Helps you tell the banners apart in this list.', width: '50%' },
        },
        {
          name: 'alt',
          label: 'Description for screen readers',
          type: 'text',
          maxLength: 200,
          admin: {
            description: 'Optional. Defaults to the image’s own description.',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'active',
      label: 'Show this banner',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Untick to hide it from the site without deleting it.' },
    },
  ],
})

export const AdsBanners: GlobalConfig = {
  slug: 'ads-banners',
  label: 'Ads banners',
  admin: {
    group: 'Site',
    description:
      'The advertisement banners of the homepage. Add as many as you need, delete the ones you no longer want, and choose for each one where it links and whether it opens in the same window or a new tab.',
  },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Top ads banner',
          description:
            'Wide banners on the homepage, one below the other. They sit where the “Top ads banner” section is in the Homepage layout (above Shorts); move it with the arrows in Website manager → Homepage. With no such section they stay right under the menu bar.',
          fields: [
            adRows({
              name: 'top',
              label: 'Top banners',
              phone: true,
              max: 6,
              help: 'As wide as the page content, with the height following the image: 1920 × 240 or larger is sharp on every screen.',
            }),
          ],
        },
        {
          label: 'Bottom ads banner',
          description: 'Banners in a column below the e-book shelf on the homepage.',
          fields: [
            adRows({
              name: 'bottom',
              label: 'Bottom banners',
              phone: false,
              max: 6,
              help: 'Wide images (about 4:1, like 676 × 164, or larger) fit best.',
            }),
          ],
        },
      ],
    },
  ],
}

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  admin: { group: 'Site' },
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
  admin: { group: 'Site' },
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
  label: 'Two-step login',
  admin: {
    group: 'Team',
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

export const globals: GlobalConfig[] = [
  SiteSettings,
  Header,
  Homepage,
  AdsBanners,
  Footer,
  SecuritySettings,
]
