import type { Field, GlobalConfig } from 'payload'
import { isEditor, totpPublicRead } from '@/payload/access'
import { linkGroup } from '@/payload/fields'
import { hooks, publicRead, siteTabs } from './shared'

/**
 * The site's link lists: Header (main menu + top links) and Footer (columns + bottom bar). Each
 * form is split into tabs; the tabs are unnamed, so the saved data keeps the same shape.
 */
const menuItem = (children?: Field): Field[] => [linkGroup('link'), ...(children ? [children] : [])]
/** Folded menu / footer rows are named after their link text ("About us"), not "Main Menu 03". */
const LINK_ROW_LABEL = '/payload/admin/site/LinkRowLabel#LinkRowLabel'

export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Navigation',
  admin: { group: 'Website', components: siteTabs },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  // Main menu first: it is what editors change most. Unnamed tabs keep the saved data's shape.
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Main menu',
          description:
            'The blue navigation bar. Drag a row to reorder it; open it to add links inside (up to three levels).',
          fields: [
            {
              name: 'mainMenu',
              type: 'array',
              maxRows: 14,
              label: 'Menu items',
              // Folded: open one menu item to edit it (all open, the page was ~24,000 px long).
              admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
              fields: menuItem({
                name: 'children',
                type: 'array',
                maxRows: 40,
                label: 'Links inside this item',
                admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
                fields: menuItem({
                  name: 'children',
                  type: 'array',
                  maxRows: 40,
                  label: 'Links inside this link',
                  admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
                  fields: menuItem(),
                }),
              }),
            },
          ],
        },
        {
          label: 'Top links',
          description:
            'Small links beside the logo on desktop and at the bottom of the mobile menu (e.g. About Us · Postal Library).',
          fields: [
            {
              name: 'topBarLinks',
              type: 'array',
              maxRows: 6,
              label: 'Header links',
              admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
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
          ],
        },
      ],
    },
  ],
}

export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Footer',
  admin: { group: 'Website', components: siteTabs },
  custom: totpPublicRead,
  access: { read: publicRead, update: isEditor },
  hooks,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Columns',
          description:
            'The dark footer, up to four columns side by side (e.g. Quick Links · Quick Contact · Follow Us).',
          fields: [
            {
              name: 'columns',
              type: 'array',
              maxRows: 4,
              admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'title',
                      type: 'text',
                      required: true,
                      maxLength: 80,
                      admin: { width: '50%' },
                    },
                    {
                      name: 'kind',
                      type: 'select',
                      required: true,
                      defaultValue: 'links',
                      label: 'Shows',
                      options: [
                        { label: 'Links', value: 'links' },
                        { label: 'Contact details (from Site settings)', value: 'contact' },
                        { label: 'Social links (from Site settings)', value: 'social' },
                        { label: 'Text', value: 'text' },
                      ],
                      admin: { width: '50%' },
                    },
                  ],
                },
                {
                  name: 'links',
                  type: 'array',
                  maxRows: 12,
                  fields: [linkGroup('link')],
                  admin: {
                    condition: (_, s) => s?.kind === 'links',
                    initCollapsed: true,
                    components: { RowLabel: LINK_ROW_LABEL },
                  },
                },
                {
                  name: 'text',
                  type: 'textarea',
                  maxLength: 600,
                  admin: { condition: (_, s) => s?.kind === 'text' },
                },
              ],
            },
          ],
        },
        {
          label: 'Bottom bar',
          description: 'The thin strip at the very bottom: a few links and the copyright line.',
          fields: [
            {
              name: 'bottomLinks',
              type: 'array',
              maxRows: 6,
              fields: [linkGroup('link')],
              admin: { initCollapsed: true, components: { RowLabel: LINK_ROW_LABEL } },
            },
            {
              name: 'copyright',
              type: 'text',
              maxLength: 200,
              defaultValue: '© Islam Malayalam. All rights reserved.',
            },
          ],
        },
      ],
    },
  ],
}
