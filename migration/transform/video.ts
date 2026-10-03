import { youtubeId } from '@/lib/security/url'

/**
 * The video of a video post: the first YouTube embed, else the first YouTube link or bare YouTube
 * URL written in a paragraph (older posts pasted the link as text). The node that only carried the
 * video is removed, so the page does not show it twice; a paragraph with other words is kept.
 */
type LexNode = Record<string, unknown> & { type?: string; children?: LexNode[] }

const YOUTUBE_URL =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?\S*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}[^\s<>"]*/gi

const textOf = (n: LexNode): string =>
  typeof n.text === 'string' ? n.text : (n.children ?? []).map(textOf).join('')

function linkUrls(n: LexNode): string[] {
  const own =
    n.type === 'link' ? [String((n.fields as { url?: unknown } | undefined)?.url ?? '')] : []
  return [...own, ...(n.children ?? []).flatMap(linkUrls)]
}

/** Text left once YouTube links (their text) and bare YouTube URLs are taken out. */
function leftover(n: LexNode): string {
  if (isAddressLink(n)) return ''
  if (typeof n.text === 'string') return n.text.replace(YOUTUBE_URL, '')
  return (n.children ?? []).map(leftover).join('')
}

/** A YouTube link whose visible text is just a YouTube address (WordPress auto-linked pastes). */
const isAddressLink = (n: LexNode): boolean =>
  n.type === 'link' &&
  Boolean(youtubeId(linkUrls(n)[0] ?? '')) &&
  !textOf(n).replace(YOUTUBE_URL, '').trim()

/** Remove pasted YouTube addresses from the text; links with real words are left alone. */
function stripBareUrls(n: LexNode): void {
  if (n.type === 'link') return
  if (typeof n.text === 'string') n.text = n.text.replace(YOUTUBE_URL, '').replace(/\s+$/u, '')
  if (n.children) {
    n.children = n.children.filter((c) => !isAddressLink(c))
    n.children.forEach(stripBareUrls)
  }
}

export function takeVideo(root: { children: LexNode[] }): string | null {
  const blocks = root.children
  const embed = blocks.findIndex(
    (n) => n.type === 'block' && (n.fields as { blockType?: string })?.blockType === 'youtube',
  )
  if (embed >= 0) {
    const url = String((blocks[embed]!.fields as { url?: unknown }).url ?? '')
    blocks.splice(embed, 1)
    return url
  }
  for (const [i, n] of blocks.entries()) {
    if (n.type !== 'paragraph') continue
    const candidates = [...linkUrls(n), ...(textOf(n).match(YOUTUBE_URL) ?? [])]
    const url = candidates.find((u) => /^https?:\/\//i.test(u) && youtubeId(u))
    if (!url) continue
    if (!leftover(n).replace(/[\s\p{P}]+/gu, '')) blocks.splice(i, 1)
    else stripBareUrls(n)
    return url
  }
  return null
}
