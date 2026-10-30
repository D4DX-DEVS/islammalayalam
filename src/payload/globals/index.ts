import type { Field, GlobalConfig, TextFieldSingleValidation } from 'payload'
import { isAdmin, isEditor, totpPublicRead } from '@/payload/access'
import { validateAdLink } from '@/payload/fields'
import { mainColumnBlocks, sidebarBlocks } from '@/payload/blocks/homepage'
import { auditGlobalChange } from '@/payload/hooks/auditLog'
import { applyMfaSetting, SECURITY_SETTINGS } from '@/payload/mfa'
import { Footer, Header } from './menus'
import { hooks, publicRead, siteTabs } from './shared'

/**
 * Site-wide, editor-controlled globals: settings, homepage layout, ads banners (header and footer
 * live in menus.ts). Public read (rendered on every page); writes are guarded, audited, revalidated.
 */
export { Footer, Header }

const httpsOnly: TextFieldSingleValidation = (v) =>
  !v || /^https:\/\/[^\s]+$/.test(v) ? true : 'Only https:// links'
const imageUpload = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'upload',
  relationTo: 'media',
  filterOptions: { mimeType: { contains: 'image' } },
  admin: description ? { description } : undefined,
})

/** Site settings → Contact. Read by the footer, Quick Contact, the About page and the WhatsApp button. */
const contactGroup: Field = {
  name: 'contact',
  type: 'group',
  label: false,
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
        description: 'The message that is ready in the chat box when a visitor taps the button.',
      },
    },
    { name: 'address', type: 'textarea', maxLength: 400 },
  ],
}

/** Site settings → Social links: one https:// address per network; empty hides its icon. */
const socialGroup: Field = {
  name: 'social',
  type: 'group',
  label: false,
  fields: (
    [
      ['facebook', 'Facebook'],
      ['x', 'X (Twitter)'],
      ['instagram', 'Instagram'],
      ['youtube', 'YouTube'],
      ['whatsapp', 'WhatsApp channel or link'],
      ['telegram', 'Telegram'],
      ['spotify', 'Spotify'],
    ] as const
  ).map(([name, label]): Field => ({ name, label, type: 'text', validate: httpsOnly })),
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Website', components: siteTabs },
  custom: totpPublicRead,
  access: { read: publicRead, update: isAdmin },
  hooks,
  // Unnamed tabs only group the form (Brand · Contact · Social links); the saved data keeps its shape.
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Brand',
          description:
            'The name, logos and picture used across the site and when pages are shared.',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'siteName',
                  label: 'Site name',
                  type: 'text',
                  required: true,
                  defaultValue: 'Islam Malayalam',
                  admin: { width: '50%' },
                },
                {
                  name: 'siteNameMl',
                  label: 'Site name in Malayalam',
                  type: 'text',
                  defaultValue: 'ഇസ്‌ലാം മലയാളം',
                  admin: { width: '50%' },
                },
              ],
            },
            { name: 'tagline', type: 'text', maxLength: 200 },
            imageUpload('logo', 'Logo', 'Main logo (left)'),
            imageUpload(
              'partnerLogo',
              'Partner logo',
              'Shown on the right, e.g. Dialogue Centre Kerala',
            ),
            { name: 'partnerUrl', label: 'Partner link', type: 'text', validate: httpsOnly },
            imageUpload(
              'defaultOgImage',
              'Social share image',
              'Used when a shared page has no picture of its own (1200 × 630).',
            ),
          ],
        },
        {
          label: 'Contact',
          description:
            'Shown in the footer, the Quick Contact box and the About page. The WhatsApp number also adds the chat button.',
          fields: [contactGroup],
        },
        {
          label: 'Social links',
          description:
            'Full https:// addresses of the site’s own pages. Leave a network empty to hide its icon.',
          fields: [socialGroup],
        },
      ],
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
  label: 'Banners',
  admin: {
    group: 'Website',
    components: siteTabs,
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
            'Wide banners on the homepage, one below the other. They sit where the “Top ads banner” section is in the Homepage layout (above Shorts); move it with the arrows in Site → Overview. With no such section they stay right under the menu bar.',
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
  admin: { group: 'Website', components: siteTabs },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      name: 'layout',
      type: 'blocks',
      blocks: mainColumnBlocks,
      maxRows: 30,
      label: 'Homepage sections',
      admin: {
        description:
          'Top to bottom, as visitors see them. Drag ⋮⋮ to reorder, click a section to change it, and tick “Hide this section” to take it off the page without deleting it.',
        initCollapsed: true,
      },
    },
    {
      name: 'sidebar',
      type: 'blocks',
      blocks: sidebarBlocks,
      maxRows: 15,
      label: 'Sidebar sections',
      admin: {
        description: 'Right-hand column on desktop; shown after the main sections on phones.',
        initCollapsed: true,
      },
    },
  ],
}

/**
 * Admin-only sign-in policy (src/payload/mfa.ts). Not public: it is never rendered on the site, so it
 * sits under Team (who may sign in, and how) rather than among the Site tabs.
 */
export const SecuritySettings: GlobalConfig = {
  slug: SECURITY_SETTINGS,
  label: 'Two-step login',
  admin: {
    group: 'Team',
    description:
      'Asks everyone for a 6-digit code from an authenticator app after their password. Changes take effect at the next sign-in.',
    // One self-saving switch (TwoStepSwitch) with its own confirmation: no Save button.
    components: {
      elements: { SaveButton: '/payload/admin/mfa/NoSaveButton#NoSaveButton' },
    },
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

/**
 * Where the renewed Instagram token is kept (features/instagram/queries.ts). Long-lived tokens last
 * 60 days and each renewal returns a new one, so it has to be stored; INSTAGRAM_ACCESS_TOKEN is only
 * the first. No access through the API or the admin: only the server's own code reads or writes it.
 */
export const InstagramConnection: GlobalConfig = {
  slug: 'instagram-connection',
  label: 'Instagram connection',
  admin: { group: 'Website', hidden: true },
  access: { read: () => false, update: () => false },
  fields: [
    { name: 'token', type: 'text', maxLength: 2000 },
    { name: 'refreshedAt', type: 'date' },
    // Which INSTAGRAM_ACCESS_TOKEN the stored token was renewed from (sha256, never the token).
    { name: 'sourceHash', type: 'text', maxLength: 64 },
  ],
}

export const globals: GlobalConfig[] = [
  SiteSettings,
  Header,
  Homepage,
  AdsBanners,
  Footer,
  SecuritySettings,
  InstagramConnection,
]
