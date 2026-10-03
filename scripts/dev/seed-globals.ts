import type { Payload } from 'payload'
import { decodeEntities, pageSegments } from './fixtures'
import { normalizeSlug } from '@/lib/text/slug'

type IaItem = { title: string; href: string; children?: IaItem[] }
type Ctx = {
  menu: IaItem[]
  categoryIds: Map<string, string>
  pageIds: Map<string, string>
  context: Record<string, unknown>
}
type Link = {
  type: 'reference' | 'custom' | 'none'
  label: string
  url?: string
  reference?: { relationTo: string; value: string }
}

/** Map an archived menu href to a CMS link: page/category reference, home URL, or label-only. */
function toLink(item: IaItem, ctx: Ctx): Link {
  const label = decodeEntities(item.title)
  if (item.href === '/') return { type: 'custom', label, url: '/' }
  const cat = /^\/category\/([^/]+)\/?$/.exec(item.href)?.[1]
  if (cat) {
    const id = ctx.categoryIds.get(normalizeSlug(cat))
    return id
      ? { type: 'reference', label, reference: { relationTo: 'categories', value: id } }
      : { type: 'none', label }
  }
  const segs = pageSegments(item.href)
  const id = segs ? ctx.pageIds.get(segs.join('/')) : undefined
  return id
    ? { type: 'reference', label, reference: { relationTo: 'pages', value: id } }
    : { type: 'none', label }
}

export async function seedGlobals(payload: Payload, ctx: Ctx): Promise<void> {
  const common = { overrideAccess: true, context: ctx.context }
  const cat = (slug: string) => ctx.categoryIds.get(slug)

  await payload.updateGlobal({
    slug: 'site-settings',
    ...common,
    data: {
      siteName: 'Islam Malayalam',
      siteNameMl: 'ഇസ്‌ലാം മലയാളം',
      tagline: 'ഇസ്‌ലാമിനെ അറിയാൻ',
      partnerUrl: null,
      social: {
        facebook: 'https://www.facebook.com/islammalayalam.net/',
        x: 'https://twitter.com/islammalayalam1',
        instagram: 'https://www.instagram.com/',
        youtube: 'https://www.youtube.com/channel/UCtW1PHQqI9IrbnTFw_vkKtA',
      },
      contact: {
        phone: '0495 4024510',
        address: 'Dialogue Centre Kerala\nHira Centre, Mavoor Road\nKozhikode, 673 004',
      },
    },
  })

  const menuItem = (item: IaItem): Record<string, unknown> => ({
    link: toLink(item, ctx),
    children: (item.children ?? []).map((c) => ({
      link: toLink(c, ctx),
      children: (c.children ?? []).map((g) => ({ link: toLink(g, ctx) })),
    })),
  })
  await payload.updateGlobal({
    slug: 'header',
    ...common,
    data: {
      showSocialInTopBar: true,
      topBarLinks: [
        {
          link: {
            type: 'reference',
            label: 'About Us',
            reference: { relationTo: 'pages', value: ctx.pageIds.get('about') },
          },
        },
        {
          link: {
            type: 'reference',
            label: 'Postal Library',
            reference: { relationTo: 'pages', value: ctx.pageIds.get('postal-2') },
          },
        },
      ],
      mainMenu: ctx.menu.map(menuItem),
    },
  })

  await payload.updateGlobal({
    slug: 'homepage',
    ...common,
    data: {
      // blockName is the row title editors see in Admin → Homepage.
      layout: [
        {
          blockType: 'featuredSlider',
          blockName: 'Hero — featured stories',
          source: 'featured',
          limit: 5,
        },
        {
          blockType: 'categoryFeature',
          blockName: 'സമകാലികം — lead + list',
          width: 'full',
          category: cat('news'),
          layout: 'split',
          limit: 5,
          showMoreLink: true,
        },
        {
          blockType: 'categoryGrid',
          blockName: 'ചോദ്യോത്തരം — card grid',
          width: 'full',
          category: cat('ചോദ്യോത്തരം'),
          columns: '3',
          limit: 6,
          showMoreLink: true,
        },
        {
          blockType: 'mediaShelf',
          blockName: 'Videos band',
          width: 'full',
          format: 'video',
          title: 'Videos',
          limit: 4,
          category: cat('videos'),
        },
        {
          blockType: 'categoryFeature',
          blockName: 'ലേഖനം — feature + list',
          width: 'full',
          category: cat('ലേഖനം'),
          layout: 'stacked',
          limit: 5,
          showMoreLink: true,
        },
        {
          blockType: 'mediaShelf',
          blockName: 'Audios (half)',
          width: 'half',
          format: 'audio',
          title: 'Audios',
          limit: 3,
          category: cat('audios'),
        },
        {
          blockType: 'mediaShelf',
          blockName: 'E-Books (half)',
          width: 'half',
          format: 'ebook',
          title: 'E-Books',
          limit: 3,
          category: cat('e-books'),
        },
      ],
      sidebar: [],
    },
  })

  await payload.updateGlobal({
    slug: 'footer',
    ...common,
    data: {
      columns: [
        {
          title: 'Quick Links',
          kind: 'links',
          // External URLs come from the WordPress widgets during migration; labels only for now.
          links: [
            'Quran Lalithasaram',
            'Thafheemul Quran',
            'Islamic Publishing House',
            'Prabodhanam Weekly',
            'Islamonlive',
          ].map((label) => ({ link: { type: 'none' as const, label } })),
        },
        { title: 'Quick Contact', kind: 'contact' },
        { title: 'Follow Us', kind: 'social' },
      ],
      copyright: '© Islam Malayalam. All rights reserved.',
    },
  })
}
