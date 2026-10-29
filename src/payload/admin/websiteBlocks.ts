import { spotifyShowId } from '@/lib/spotify-show'
import { adsDetail, shownAds as shown } from '@/payload/admin/adsSummary'
import type { SectionRow } from '@/payload/admin/websiteModel'
import type { AdsBanner, Category, Homepage } from '@/payload-types'

/** The rows of the Website manager's homepage list. Pure (no Payload, no I/O): see websiteModel.ts. */
export type Block =
  | NonNullable<Homepage['layout']>[number]
  | NonNullable<Homepage['sidebar']>[number]

const catName = (value: unknown): string | null =>
  value && typeof value === 'object' ? ((value as Category).name ?? null) : null
const catSlug = (value: unknown): string | null =>
  value && typeof value === 'object' ? ((value as Category).slug ?? null) : null
const WIDTH = (b: { width?: 'full' | 'half' | null }) =>
  b.width === 'half' ? 'half width' : 'full width'
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** One homepage block → a readable row. Unknown future block types still get a row. */
export function describeBlock(
  block: Block,
  index: number,
  edit: { href: string | null; label: string },
  extras: {
    audiosWithoutAudio?: number | null
    bottomAds?: number
    topAds?: AdsBanner['top']
    adsEditHref?: string | null
  } = {},
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
          note: 'Videos open in a popup player. Add one as a post: New post → “This post is: A video” → paste the YouTube link under Media & files.',
        }
      if (block.format === 'audio')
        return {
          ...base,
          label: block.title || 'Audios',
          icon: 'audio',
          detail: `Podcast-style player with search and a scrolling list · ${scope} · ${spotifyShowId(block.spotifyUrl) ? 'every episode of your Spotify show (up to 50), updated automatically' : `up to ${plural(block.limit, 'episode')} · ${block.spotifyUrl ? 'Spotify button on' : 'no Spotify button'}`} · ${WIDTH(block)}`,
          note: spotifyShowId(block.spotifyUrl)
            ? 'New episodes of the Spotify show appear here by themselves, within about 15 minutes. Until the site developer adds Spotify app keys on the server, Spotify only hands over the newest episode: add each other episode as an Audio post (New post → “This post is: An audio” → its Spotify link), and it is listed in full.'
            : extras.audiosWithoutAudio
              ? `${plural(extras.audiosWithoutAudio, 'Audio post')} ${extras.audiosWithoutAudio === 1 ? 'has' : 'have'} no audio yet. Open the post → Media & files → Audio and add a Spotify link.`
              : block.spotifyUrl
                ? 'Each Audio post can have its own Spotify link (plays in the player) or a hosted audio link.'
                : 'Add your Spotify show link to this section and its episodes are listed here by themselves; or add a Spotify link or hosted audio link in each Audio post.',
        }
      return {
        ...base,
        label: block.title || 'E-Books',
        icon: 'ebook',
        detail: `Cover shelf · ${scope} · ${plural(block.limit, 'book')} · ${plural(extras.bottomAds ?? 0, 'banner ad')} below · ${WIDTH(block)}`,
        note: 'Add the cover image and the PDF in each E-book post. The banner ads below the shelf are edited under Ads banners → Bottom ads banner.',
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
    case 'shorts':
      return {
        ...base,
        label: block.title || 'Shorts',
        icon: 'shorts',
        detail: `Latest YouTube Shorts from ${block.channel || 'a channel'} · loads new ones by itself`,
      }
    case 'topAds':
      return {
        ...base,
        label: 'Top ads banner',
        icon: 'banner',
        detail: adsDetail(
          extras.topAds,
          'Wide banner drawn at this position',
          'Nothing is shown here yet: add a banner under Ads banners → Top ads banner',
        ),
        note: 'Move it up or down with the arrows to change where it sits on the homepage. The pictures and links are edited under Ads banners.',
        moreHref: extras.adsEditHref ?? null,
        moreLabel: shown(extras.topAds) ? 'Edit banners' : 'Add a banner',
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
