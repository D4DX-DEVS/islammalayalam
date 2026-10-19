import type { Payload } from 'payload'
import { decodeEntities, pageSegments } from './fixtures'
import { normalizeSlug } from '@/lib/text/slug'
import type { CallToActionBlock, FaqBlock, Homepage } from '@/payload-types'

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

/** Revamp sample content (local dev only). Text says മാതൃക; links use reserved .invalid hosts. */
const SAMPLE_URL = (name: string) => `https://${name}.invalid/`
const SAMPLE_REELS = ['wB70YxLsM-o', 'LiiaID_Q5os', 'j4mVf_j6xF4', 't4q8vNqzLjg']
const SAMPLE_SIDEBAR: NonNullable<Homepage['sidebar']> = [
  {
    blockType: 'quoteOfDay',
    blockName: 'Quote of the day',
    title: 'ഇന്നത്തെ ചിന്ത',
    quotes: [1, 2, 3].map((n) => ({
      text: `മാതൃകാ ചിന്ത ${n}: ഇവിടെ ഓരോ ദിവസവും ഒരു ചിന്ത മാറിമാറി വരും.`,
      source: 'മാതൃക',
    })),
  },
  {
    blockType: 'callToAction',
    blockName: 'Postal Library',
    tone: 'gold',
    eyebrow: 'Postal Library',
    heading: 'പുസ്തകങ്ങള്‍ തപാലില്‍',
    text: 'മാതൃക: പോസ്റ്റല്‍ ലൈബ്രറിയില്‍ നിന്ന് പുസ്തകങ്ങള്‍ വീട്ടിലെത്തിക്കാം.',
    buttons: [
      {
        link: { type: 'custom', label: 'പുസ്തകങ്ങള്‍', url: SAMPLE_URL('postal-library') },
        style: 'primary',
      },
      {
        link: { type: 'custom', label: 'ഖുര്‍ആന്‍ ഓര്‍ഡര്‍', url: SAMPLE_URL('quran-order') },
        style: 'secondary',
      },
    ],
  },
  {
    blockType: 'reels',
    blockName: 'Reels',
    title: 'സംശയനിവാരണം',
    videos: SAMPLE_REELS.map((id, i) => ({
      url: `https://www.youtube.com/shorts/${id}`,
      title: `മാതൃകാ റീല്‍ ${i + 1}`,
    })),
  },
  { blockType: 'followUs', blockName: 'Follow us', title: 'Follow Us' },
]
const SAMPLE_COURSE: CallToActionBlock = {
  blockType: 'callToAction',
  blockName: 'Understanding Islam course',
  tone: 'navy',
  eyebrow: 'Online course',
  heading: 'UNDERSTANDING ISLAM',
  text: 'മാതൃക: കോഴ്സ് വിവരങ്ങള്‍ ഇവിടെ വരും.',
  details: [
    { label: 'Mode', value: 'Online' },
    { label: 'Duration', value: 'മാതൃക' },
  ],
  buttons: [
    {
      link: { type: 'custom', label: 'Register', url: SAMPLE_URL('course-register') },
      style: 'primary',
    },
  ],
}
const SAMPLE_LALITHASARAM: CallToActionBlock = {
  blockType: 'callToAction',
  blockName: 'Quran Lalithasaram banner',
  tone: 'gold',
  eyebrow: 'ഖുര്‍ആന്‍',
  heading: 'ഖുര്‍ആന്‍ ലളിതസാരം',
  text: 'മാതൃക: ലളിതസാരം ബാനര്‍ വിവരണം.',
  buttons: [
    {
      link: { type: 'custom', label: 'വായിക്കുക', url: SAMPLE_URL('lalithasaram') },
      style: 'primary',
    },
  ],
}
const SAMPLE_FAQ: FaqBlock = {
  blockType: 'faq',
  blockName: 'FAQ',
  title: 'പൊതുവായ ചോദ്യങ്ങള്‍',
  items: [1, 2, 3, 4].map((n) => ({
    question: `മാതൃകാ ചോദ്യം ${n}?`,
    answer: `മാതൃകാ ഉത്തരം ${n}. യഥാര്‍ഥ ചോദ്യോത്തരങ്ങള്‍ Admin → Homepage-ല്‍ ചേര്‍ക്കാം.`,
  })),
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
          highlight: true,
        },
        // Placeholder until the client sends the real order link (.invalid never resolves).
        {
          link: { type: 'custom', label: 'ഖുര്‍ആന്‍ ഓര്‍ഡര്‍', url: SAMPLE_URL('quran-order') },
          highlight: true,
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
        SAMPLE_LALITHASARAM,
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
        SAMPLE_COURSE,
        SAMPLE_FAQ,
      ],
      sidebar: SAMPLE_SIDEBAR,
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
