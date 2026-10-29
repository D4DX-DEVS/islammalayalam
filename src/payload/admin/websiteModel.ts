import { whatsappLink } from '@/lib/whatsapp'
import { adsRow, shownAds as shown } from '@/payload/admin/adsSummary'
import { describeBlock, plural, type Block } from '@/payload/admin/websiteBlocks'
import type { AdsBanner, Category, Footer, Header, Homepage, SiteSetting } from '@/payload-types'

/**
 * The "Website manager" model: the public site as an ordered list of sections, each with a plain
 * description and the admin screen that edits it. Pure (no Payload, no I/O) so it is unit-tested and
 * can be previewed without a database; websiteData.ts gathers the inputs as the signed-in user.
 */
export type SectionIcon =
  | 'header'
  | 'settings'
  | 'footer'
  | 'hero'
  | 'strip'
  | 'lead'
  | 'topics'
  | 'grid'
  | 'list'
  | 'video'
  | 'audio'
  | 'ebook'
  | 'text'
  | 'banner'
  | 'promo'
  | 'faq'
  | 'quote'
  | 'reels'
  | 'shorts'
  | 'links'
  | 'contact'
  | 'social'
  | 'chat'
  | 'ai'

export type SectionRow = {
  key: string
  label: string
  detail: string
  icon: SectionIcon
  /** Built from other content (Categories) rather than placed in the Homepage editor. */
  auto?: boolean
  /** The editor switched it off ("Hide this section"). */
  hidden?: boolean
  /** Where the content comes from / what to do about it, when something is missing. */
  note?: string
  /** Shown instead of "View only" when nothing here is edited in the admin (e.g. a server setting). */
  readOnly?: string
  editHref: string | null
  editLabel: string
  /** A second link beside Edit (e.g. the screen where the banner pictures are set). */
  moreHref?: string | null
  moreLabel?: string
  /**
   * A section of the Homepage layout that can be moved up or down from the manager: which list it
   * is in, its id, and whether it is already first / last there.
   */
  move?: { field: 'layout' | 'sidebar'; id: string; first: boolean; last: boolean }
  viewHref: string
}

export type WebsiteData = {
  site: SectionRow[]
  homepage: SectionRow[]
  sidebar: SectionRow[]
  /** True when the Homepage editor has no sections yet. */
  homepageEmpty: boolean
  /** The Homepage editor, when this role may change it: one button for the whole section list. */
  homepageEditHref: string | null
}

/** What a role may do, reduced to the questions the page asks. */
export type SitePermissions = {
  readCollection: (slug: string) => boolean
  createCollection: (slug: string) => boolean
  updateCollection: (slug: string) => boolean
  updateGlobal: (slug: string) => boolean
}

export type WebsiteInput = {
  /** Admin route prefix, e.g. "/admin". */
  admin: string
  can: SitePermissions
  homepage: Homepage | null
  header: Header | null
  /** The Ads banners global (top and bottom ad banners). */
  ads?: AdsBanner | null
  footer: Footer | null
  settings: SiteSetting | null
  categories: Category[]
  /** AI search is switched on (an API key is set on the server). */
  aiSearchOn: boolean
  counts: {
    /** Active quotes, shown as "Insights" (the homepage sidebar slider and its archive). */
    quotes?: number | null
    /** Published audio posts that have neither a Spotify link nor a hosted audio link. */
    audiosWithoutAudio?: number | null
  }
}

export function buildWebsite({
  admin,
  can,
  homepage,
  header,
  ads,
  footer,
  settings,
  categories,
  aiSearchOn,
  counts,
}: WebsiteInput): WebsiteData {
  const whatsappOn = Boolean(
    whatsappLink({
      number: settings?.contact?.whatsappNumber,
      message: settings?.contact?.whatsappMessage,
      url: settings?.social?.whatsapp,
    }),
  )
  const global = (slug: string) => `${admin}/globals/${slug}`
  const col = (slug: string) => `${admin}/collections/${slug}`
  const homeEdit = {
    href: can.updateGlobal('homepage') ? global('homepage') : null,
    label: 'Edit in Homepage',
  }
  const stripShown = categories.filter((c) => c.showInStrip !== false && !c.hidden).length

  const adsEdit = can.updateGlobal('ads-banners') ? global('ads-banners') : null
  const layout = (homepage?.layout ?? []) as Block[]
  const extras = {
    audiosWithoutAudio: counts.audiosWithoutAudio,
    bottomAds: shown(ads?.bottom),
    topAds: ads?.top,
    adsEditHref: adsEdit,
  }
  // With the right to edit the Homepage, each section also gets Move up / Move down.
  const movable = can.updateGlobal('homepage')
  const describe = (
    b: Block,
    i: number,
    field: 'layout' | 'sidebar',
    count: number,
  ): SectionRow => {
    const row = describeBlock(b, i, homeEdit, extras)
    return movable && b.id
      ? { ...row, move: { field, id: b.id, first: i === 0, last: i === count - 1 } }
      : row
  }
  const rows: SectionRow[] = layout.map((b, i) => describe(b, i, 'layout', layout.length))
  // The strip sits right under the hero; the Insights sidebar is added beside the first lead block
  // when the editor has not placed a topics block (see HomeBlocks.leadWithAside).
  const heroAt = layout.findIndex((b) => b.blockType === 'featuredSlider')
  rows.splice(heroAt + 1, 0, {
    key: 'category-strip',
    label: 'Category shortcuts',
    icon: 'strip',
    auto: true,
    detail: `${plural(stripShown, 'round icon tile')} — one per visible category, in the order set in Categories`,
    editHref: can.updateCollection('categories') ? col('categories') : null,
    editLabel: 'Edit categories',
    viewHref: '/',
  })
  if (!layout.some((b) => b.blockType === 'topicGrid')) {
    const leadAt = layout.findIndex(
      (b) => b.blockType === 'categoryFeature' && b.layout !== 'stacked' && b.width !== 'half',
    )
    if (leadAt >= 0) {
      const at = rows.findIndex((r) =>
        r.key.startsWith(`categoryFeature-${layout[leadAt]!.id ?? leadAt}`),
      )
      rows.splice(at + 1, 0, {
        key: 'auto-quote-sidebar',
        label: 'Insights sidebar',
        icon: 'quote',
        auto: true,
        detail:
          'The right-hand 25% beside the lead section: a slider of the first 5 Insights posters with the share options, and “View More” for the archive (a site card until the first one is added)',
        editHref:
          can.createCollection('quotes') || can.updateCollection('quotes') ? col('quotes') : null,
        editLabel: 'Manage insights',
        viewHref: '/',
      })
    }
  }

  const sidebarBlocks = (homepage?.sidebar ?? []) as Block[]
  const sidebar = sidebarBlocks.map((b, i) => describe(b, i, 'sidebar', sidebarBlocks.length))

  const site: SectionRow[] = [
    {
      key: 'header',
      label: 'Header & main menu',
      icon: 'header',
      detail: header
        ? `${plural(header.mainMenu?.length ?? 0, 'menu section')} · ${plural(header.topBarLinks?.length ?? 0, 'top link')} · social icons ${header.showSocialInTopBar === false ? 'hidden' : 'shown'}`
        : 'Menus and top-bar links',
      editHref: can.updateGlobal('header') ? global('header') : null,
      editLabel: 'Edit header',
      viewHref: '/',
    },
    // Once the Homepage layout has a "Top ads banner" section it is listed (and moved) there.
    ...(layout.some((b) => b.blockType === 'topAds')
      ? []
      : [
          adsRow({
            key: 'top-banner',
            label: 'Top ads banner',
            rows: ads?.top,
            what: 'Wide banner under the menu bar of the homepage',
            empty: 'Not shown yet: add a banner under Ads banners → Top ads banner',
            editHref: adsEdit,
          }),
        ]),
    adsRow({
      key: 'bottom-banners',
      label: 'Bottom ads banner',
      rows: ads?.bottom,
      what: 'Banners below the e-book shelf of the homepage',
      empty: 'Not shown yet: add a banner under Ads banners → Bottom ads banner',
      editHref: adsEdit,
    }),
    {
      key: 'settings',
      label: 'Logo, tagline, contact & social links',
      icon: 'settings',
      detail: settings
        ? `${settings.siteName}${settings.tagline ? ` · “${settings.tagline}”` : ''}`
        : 'Site name, logo, tagline, address, phone, e-mail, social networks',
      editHref: can.updateGlobal('site-settings') ? global('site-settings') : null,
      editLabel: 'Edit settings',
      viewHref: '/',
    },
    {
      key: 'footer',
      label: 'Footer',
      icon: 'footer',
      detail: footer
        ? `${plural(footer.columns?.length ?? 0, 'column')} · ${plural(footer.bottomLinks?.length ?? 0, 'bottom link')}`
        : 'Link columns, contact and copyright',
      editHref: can.updateGlobal('footer') ? global('footer') : null,
      editLabel: 'Edit footer',
      viewHref: '/',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp chat button',
      icon: 'chat',
      detail: whatsappOn
        ? 'Green button at the bottom right of every page; opens a chat with the number in Site settings'
        : 'Hidden until a WhatsApp number is entered in Site settings → Contact',
      editHref: can.updateGlobal('site-settings') ? global('site-settings') : null,
      editLabel: whatsappOn ? 'Edit number' : 'Add a number',
      viewHref: '/',
    },
    {
      key: 'daily-quote',
      label: 'Insights',
      icon: 'quote',
      detail: counts.quotes
        ? `${plural(counts.quotes, 'active insight')}: the first 5 slide in the homepage sidebar beside the first lead section, with sharing to every network; the rest are in the “View More” archive`
        : 'Not shown yet: add an insight and a poster slider appears in the homepage sidebar beside the first lead section',
      note:
        counts.quotes === 0
          ? 'Until there is a quote, the section beside it keeps the full width.'
          : undefined,
      editHref:
        can.createCollection('quotes') || can.updateCollection('quotes') ? col('quotes') : null,
      editLabel: counts.quotes ? 'Manage insights' : 'Add an insight',
      viewHref: '/',
    },
    {
      key: 'ai-search',
      label: 'AI search',
      icon: 'ai',
      detail: aiSearchOn
        ? 'On: the sparkle button in the search box answers a visitor’s question from the articles, with links to its sources'
        : 'Off: no AI buttons are shown and search works as before',
      note: aiSearchOn
        ? undefined
        : 'Turn it on by setting ANTHROPIC_API_KEY on the server (see docs/ENVIRONMENT.md).',
      readOnly: 'Set on the server',
      editHref: null,
      editLabel: '',
      viewHref: '/search/',
    },
  ]

  return {
    site,
    homepage: rows,
    sidebar,
    homepageEmpty: layout.length === 0,
    homepageEditHref: homeEdit.href,
  }
}
