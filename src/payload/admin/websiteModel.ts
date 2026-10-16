import { whatsappLink } from '@/lib/whatsapp'
import type { Category, Footer, Header, Homepage, SiteSetting } from '@/payload-types'

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
  viewHref: string
}

export type ContentCard = {
  key: string
  label: string
  hint: string
  count: number | null
  listHref: string
  createHref: string | null
}

export type WebsiteData = {
  site: SectionRow[]
  homepage: SectionRow[]
  sidebar: SectionRow[]
  content: ContentCard[]
  /** True when the Homepage editor has no sections yet. */
  homepageEmpty: boolean
}

type Block = NonNullable<Homepage['layout']>[number] | NonNullable<Homepage['sidebar']>[number]

const catName = (value: unknown): string | null =>
  value && typeof value === 'object' ? ((value as Category).name ?? null) : null
const catSlug = (value: unknown): string | null =>
  value && typeof value === 'object' ? ((value as Category).slug ?? null) : null
const WIDTH = (b: { width?: 'full' | 'half' | null }) =>
  b.width === 'half' ? 'half width' : 'full width'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** One homepage block → a readable row. Unknown future block types still get a row. */
function describeBlock(
  block: Block,
  index: number,
  edit: { href: string | null; label: string },
  extras: { audiosWithoutAudio?: number | null } = {},
): SectionRow {
  const base = {
    key: `${block.blockType}-${block.id ?? index}`,
    hidden: Boolean(block.hidden),
    editHref: edit.href,
    editLabel: edit.label,
    viewHref: '/',
  }
  switch (block.blockType) {
    case 'featuredSlider':
      return {
        ...base,
        label: 'Hero slider',
        icon: 'hero',
        detail: `${block.source === 'category' ? `Posts of ${catName(block.category) ?? 'a category'}` : 'Posts marked “Featured”'} · up to ${plural(Math.min(block.limit, 5), 'slide')} · side column “${block.sideTitle || 'പുതിയ വാർത്തകൾ'}” lists the newest posts`,
      }
    case 'categoryFeature':
      return {
        ...base,
        label: block.title || catName(block.category) || 'Category section',
        icon: 'lead',
        detail: `${block.layout === 'stacked' ? 'Feature card + list rows' : 'Navy lead card + list'} · ${catName(block.category) ?? 'no category'} · ${plural(block.limit, 'post')} · ${WIDTH(block)}`,
        viewHref: catSlug(block.category) ? `/category/${catSlug(block.category)}/` : '/',
      }
    case 'topicGrid':
      return {
        ...base,
        label: block.title || 'Topic tiles',
        icon: 'topics',
        detail: `${block.categories?.length ? plural(block.categories.length, 'chosen category', 'chosen categories') : 'First categories, automatically'} · up to ${block.limit} tiles with article counts · ${WIDTH(block)}`,
      }
    case 'categoryGrid':
      return {
        ...base,
        label: block.title || catName(block.category) || 'Card grid',
        icon: 'grid',
        detail: `${block.columns}-column cards · ${catName(block.category) ?? 'no category'} · ${plural(block.limit, 'post')} · ${WIDTH(block)}`,
        viewHref: catSlug(block.category) ? `/category/${catSlug(block.category)}/` : '/',
      }
    case 'categoryList':
      return {
        ...base,
        label: block.title || catName(block.category) || 'Compact list',
        icon: 'list',
        detail: `${block.showThumbnails ? 'With thumbnails' : 'Ranked list'} · ${catName(block.category) ?? 'no category'} · ${plural(block.limit, 'post')}`,
      }
    case 'mediaShelf': {
      const scope = catName(block.category) ?? 'all posts of this type'
      if (block.format === 'video')
        return {
          ...base,
          label: block.title || 'Videos',
          icon: 'video',
          detail: `Full-width blue band with a carousel · ${scope} · ${plural(block.limit, 'video')}`,
          note: 'Videos open in a popup player. Add one in seconds from the dashboard (Add video: link, title, author — all optional), or as a Video post.',
        }
      if (block.format === 'audio')
        return {
          ...base,
          label: block.title || 'Audios',
          icon: 'audio',
          detail: `Podcast-style player with search and paging · ${scope} · up to ${plural(block.limit, 'episode')} · ${block.spotifyUrl ? 'Spotify button on' : 'no Spotify button'} · ${WIDTH(block)}`,
          note: extras.audiosWithoutAudio
            ? `${plural(extras.audiosWithoutAudio, 'Audio post')} ${extras.audiosWithoutAudio === 1 ? 'has' : 'have'} no audio yet. Add real audio in seconds from the dashboard (Add audio: link, title, author — all optional), or open the post → Media & files → Audio and add a Spotify link.`
            : block.spotifyUrl
              ? 'Each Audio post can have its own Spotify link (plays in the player) or a hosted audio link.'
              : 'Add your Spotify show or playlist link to this section for the Spotify button, and a Spotify link or hosted audio link in each Audio post.',
        }
      return {
        ...base,
        label: block.title || 'E-Books',
        icon: 'ebook',
        detail: `Cover shelf · ${scope} · ${plural(block.limit, 'book')} · ${plural(block.banners?.length ?? 0, 'banner ad')} below · ${WIDTH(block)}`,
        note: 'Add the cover image and the PDF in each E-book post. Banner ads (image + link) are added on this section.',
      }
    }
    case 'richText':
      return {
        ...base,
        label: block.title || 'Text block',
        icon: 'text',
        detail: `Free text · ${WIDTH(block)}`,
      }
    case 'banner':
      return {
        ...base,
        label: 'Banner image',
        icon: 'banner',
        detail: `Image${block.link ? ' with a link' : ''} · ${WIDTH(block)}`,
      }
    case 'callToAction':
      return {
        ...base,
        label: block.heading || 'Call to action',
        icon: 'promo',
        detail: `Promo card · ${block.buttons?.length ?? 0} buttons · ${WIDTH(block)}`,
      }
    case 'faq':
      return {
        ...base,
        label: block.title || 'FAQ',
        icon: 'faq',
        detail: `${plural(block.items?.length ?? 0, 'question')}`,
      }
    case 'quoteOfDay':
      return {
        ...base,
        label: block.title || 'Quote of the day',
        icon: 'quote',
        detail: `${plural(block.quotes?.length ?? 0, 'quote')}, one per day`,
      }
    case 'reels':
      return {
        ...base,
        label: block.title || 'Reels',
        icon: 'reels',
        detail: `${plural(block.videos?.length ?? 0, 'short video')} · YouTube Shorts`,
      }
    case 'quickLinks':
      return {
        ...base,
        label: block.title || 'Quick links',
        icon: 'links',
        detail: `${plural(block.links?.length ?? 0, 'link')}`,
      }
    case 'followUs':
      return {
        ...base,
        label: block.title || 'Follow us',
        icon: 'social',
        detail: 'Social buttons from Site settings',
        editHref: edit.href,
      }
    case 'quickContact':
      return {
        ...base,
        label: block.title || 'Quick contact',
        icon: 'contact',
        detail: 'Address, phone and e-mail from Site settings',
      }
    default:
      return { ...base, label: 'Section', icon: 'text', detail: '' }
  }
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
  footer: Footer | null
  settings: SiteSetting | null
  categories: Category[]
  /** AI search is switched on (an API key is set on the server). */
  aiSearchOn: boolean
  counts: {
    articles: number | null
    videos: number | null
    audios: number | null
    ebooks: number | null
    pages: number | null
    authors: number | null
    media: number | null
    redirects: number | null
    /** Active quotes (the daily quote in the homepage sidebar). */
    quotes?: number | null
    /** Published audio posts that have neither a Spotify link nor a hosted audio link. */
    audiosWithoutAudio?: number | null
    /** Quick audio / video entries (link, title, author) added from the dashboard. */
    audioItems?: number | null
    videoItems?: number | null
  }
}

export function buildWebsite({
  admin,
  can,
  homepage,
  header,
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

  const layout = (homepage?.layout ?? []) as Block[]
  const rows: SectionRow[] = layout.map((b, i) =>
    describeBlock(b, i, homeEdit, { audiosWithoutAudio: counts.audiosWithoutAudio }),
  )
  // The strip sits right under the hero; the Daily Quote sidebar is added beside the first lead block
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
        label: 'Daily quote sidebar',
        icon: 'quote',
        auto: true,
        detail:
          'The right-hand 25% beside the lead section: today’s quote poster with the share options (a site card until the first quote is added)',
        editHref:
          can.createCollection('quotes') || can.updateCollection('quotes') ? col('quotes') : null,
        editLabel: 'Manage quotes',
        viewHref: '/',
      })
    }
  }

  const sidebar = ((homepage?.sidebar ?? []) as Block[]).map((b, i) =>
    describeBlock(b, i, homeEdit, { audiosWithoutAudio: counts.audiosWithoutAudio }),
  )

  const topBannerOn =
    Boolean(header?.topBanner?.image || header?.topBanner?.mobileImage) &&
    !header?.topBanner?.hidden

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
    {
      key: 'top-banner',
      label: 'Top banner',
      icon: 'banner',
      detail: topBannerOn
        ? `Full-width image right below the menu bar${header?.topBanner?.mobileImage ? ' (with a phone version)' : ''}`
        : header?.topBanner?.hidden
          ? 'Switched off — tick “Hide the top banner” off in Header & menu → Top banner to show it again'
          : 'Not shown yet: add an image under Header & menu → Top banner',
      editHref: can.updateGlobal('header') ? global('header') : null,
      editLabel: topBannerOn ? 'Edit banner' : 'Add a banner',
      viewHref: '/',
    },
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
      label: 'Daily quote',
      icon: 'quote',
      detail: counts.quotes
        ? `${plural(counts.quotes, 'active quote')}: one poster a day in the homepage sidebar beside the first lead section, with sharing to every network`
        : 'Not shown yet: add a quote and a poster appears in the homepage sidebar beside the first lead section',
      note:
        counts.quotes === 0
          ? 'Until there is a quote, the section beside it keeps the full width.'
          : undefined,
      editHref:
        can.createCollection('quotes') || can.updateCollection('quotes') ? col('quotes') : null,
      editLabel: counts.quotes ? 'Manage quotes' : 'Add a quote',
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

  const card = (
    key: string,
    label: string,
    hint: string,
    n: number | null,
    slug: string,
    filter?: string,
  ): ContentCard => ({
    key,
    label,
    hint,
    count: can.readCollection(slug) ? n : null,
    listHref: filter ? `${col(slug)}?${filter}` : col(slug),
    createHref: can.createCollection(slug) ? `${col(slug)}/create` : null,
  })
  const f = (format: string) => `where[format][equals]=${format}`

  return {
    site,
    homepage: rows,
    sidebar,
    homepageEmpty: layout.length === 0,
    content: [
      card(
        'articles',
        'Articles',
        'News, Q&A and opinion pieces',
        counts.articles,
        'posts',
        f('standard'),
      ),
      card(
        'videos',
        'Videos',
        'YouTube links, shown in the blue video band',
        counts.videos,
        'posts',
        f('video'),
      ),
      card(
        'audios',
        'Audios',
        'Spotify or hosted audio, shown in the player',
        counts.audios,
        'posts',
        f('audio'),
      ),
      card(
        'audio-items',
        'Quick audio',
        'Just a link, title and author (all optional): first in the Audios player',
        counts.audioItems ?? null,
        'audios',
      ),
      card(
        'video-items',
        'Quick video',
        'Just a link, title and author (all optional): first in the Videos band',
        counts.videoItems ?? null,
        'videos',
      ),
      card('ebooks', 'E-books', 'A cover image and a PDF', counts.ebooks, 'posts', f('ebook')),
      card(
        'pages',
        'Pages',
        'Static and knowledge-base pages (tabs, sub-pages)',
        counts.pages,
        'pages',
      ),
      card(
        'categories',
        'Categories',
        'Order, icon and visibility of topics',
        categories.length || null,
        'categories',
      ),
      card('authors', 'Authors', 'Bylines shown on articles', counts.authors, 'authors'),
      card('media', 'Media library', 'Images and PDFs', counts.media, 'media'),
      card(
        'redirects',
        'Redirects',
        'Old addresses that forward to new ones',
        counts.redirects,
        'redirects',
      ),
    ],
  }
}
