import { createHash } from 'node:crypto'
import { DomUtils, ElementType, parseDocument } from 'htmlparser2'
import { youtubeId } from '@/lib/security/url'
import { rewriteHref, type LinkResolvers } from './links'

/**
 * Gate-A-clean HTML → Lexical editor state. The output only ever contains node types allowed by
 * src/lib/security/lexical-guard.ts (paragraph, text, linebreak, heading h2–h4, quote, list,
 * listitem, link, upload, horizontalrule, block[youtube]); everything else becomes one of those or
 * is dropped with a warning. HTML is never stored.
 */
type Node = Record<string, unknown> & { type: string }
/** The parts of htmlparser2's DOM this module reads (its own types live in a transitive package). */
type DomText = { type: 'text'; data: string }
type DomElement = {
  type: 'tag' | 'script' | 'style'
  name: string
  attribs: Record<string, string | undefined>
  children: DomNode[]
}
type DomNode = DomText | DomElement | { type: 'comment' | 'directive' | 'cdata' | 'root' }
const parse = (html: string): DomNode[] =>
  parseDocument(html, { decodeEntities: true }).children as unknown as DomNode[]
const elementsByTag = (name: string, nodes: DomNode[]): DomElement[] =>
  DomUtils.getElementsByTagName(name, nodes as never, true) as unknown as DomElement[]

export type ImageRef = { mediaId: string; alt?: string } | null
export type ConvertContext = LinkResolvers & {
  /** Stable seed for node ids (e.g. "post:123") so re-runs produce identical output. */
  seed: string
  /** Upload URL (as written in the HTML) → migrated media id, or null when not migrated. */
  image?: (src: string) => ImageRef
}
export type ConvertResult = { state: { root: Node }; warnings: string[] }

const BOLD = 1
const ITALIC = 2
const STRIKE = 4
const UNDERLINE = 8
const INLINE_FORMAT: Record<string, number> = {
  strong: BOLD,
  b: BOLD,
  em: ITALIC,
  i: ITALIC,
  u: UNDERLINE,
  s: STRIKE,
  strike: STRIKE,
  del: STRIKE,
}
const HEADING: Record<string, 'h2' | 'h3' | 'h4'> = {
  h1: 'h2',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h4',
  h6: 'h4',
}
/** Containers whose children are laid out as blocks (their inline runs become paragraphs). */
const BLOCK_CONTAINERS = new Set([
  'p',
  'div',
  'section',
  'article',
  'aside',
  'center',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
])

const element = (type: string, children: Node[], extra: Record<string, unknown> = {}): Node => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})
const text = (value: string, format: number): Node => ({
  type: 'text',
  text: value,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const LINEBREAK: Node = { type: 'linebreak', version: 1 }

const isTag = (n: DomNode): n is DomElement => ElementType.isTag(n as never)
const isText = (n: DomNode): n is DomText => n.type === ElementType.Text

/** Inline content with HTML whitespace collapsing; runs of equal format are merged. */
class InlineBuffer {
  nodes: Node[] = []
  push(node: Node): void {
    const last = this.nodes.at(-1)
    if (node.type === 'text' && last?.type === 'text' && last.format === node.format) {
      last.text = `${last.text as string}${node.text as string}`
    } else this.nodes.push(node)
  }
  /** Trim outer whitespace/linebreaks; null when nothing visible is left. */
  take(): Node[] | null {
    const nodes = this.nodes
    this.nodes = []
    while (nodes[0]?.type === 'linebreak') nodes.shift()
    while (nodes.at(-1)?.type === 'linebreak') nodes.pop()
    const first = nodes[0]
    if (first?.type === 'text') first.text = (first.text as string).replace(/^\s+/, '')
    const last = nodes.at(-1)
    if (last?.type === 'text') last.text = (last.text as string).replace(/\s+$/, '')
    const visible = nodes.some((n) =>
      n.type === 'text' ? (n.text as string).trim() !== '' : n.type !== 'linebreak',
    )
    return visible ? nodes.filter((n) => n.type !== 'text' || n.text !== '') : null
  }
}

export function htmlToLexical(html: string, ctx: ConvertContext): ConvertResult {
  const warnings: string[] = []
  const blocks: Node[] = []
  let counter = 0
  const nodeId = () =>
    createHash('sha1').update(`${ctx.seed}:${counter++}`).digest('hex').slice(0, 24)

  const inline = new InlineBuffer()
  const flush = (into: Node[] = blocks) => {
    const children = inline.take()
    if (children) into.push(element('paragraph', children, { textFormat: 0, textStyle: '' }))
  }

  /** Collect inline content of an element (used for headings, list items, links, quotes). */
  const collectInline = (nodes: DomNode[], format: number, inLink: boolean): Node[] => {
    const buf = new InlineBuffer()
    const visit = (n: DomNode, fmt: number): void => {
      if (isText(n)) {
        const value = n.data.replace(/[\t\n\r ]+/g, ' ')
        if (value) buf.push(text(value, fmt))
        return
      }
      if (!isTag(n)) return
      const name = n.name.toLowerCase()
      if (name === 'br') return buf.push(LINEBREAK)
      if (name === 'img' || name === 'iframe' || name === 'hr') {
        warnings.push(`${name} inside inline content dropped`)
        return
      }
      if (name === 'a' && !inLink) {
        const link = linkNode(n, fmt)
        if (link) buf.push(link)
        else n.children.forEach((c) => visit(c, fmt))
        return
      }
      const extra = INLINE_FORMAT[name] ?? 0
      // Block children inside inline context (e.g. <p> in <li>) are separated by a line break.
      const isBlock = BLOCK_CONTAINERS.has(name) || name in HEADING || name === 'blockquote'
      if (isBlock && buf.nodes.length) buf.push(LINEBREAK)
      n.children.forEach((c) => visit(c, fmt | extra))
    }
    nodes.forEach((n) => visit(n, format))
    return buf.take() ?? []
  }

  const linkNode = (a: DomElement, format: number): Node | null => {
    const href = a.attribs.href ?? ''
    const decision = rewriteHref(href, ctx)
    if (!decision.keep) {
      if (decision.reason !== 'empty') warnings.push(`link removed (${decision.reason})`)
      return null
    }
    const children = collectInline(a.children, format, true)
    if (!children.length) return null
    return element('link', children, {
      version: 3,
      fields: { linkType: 'custom', url: decision.url, newTab: decision.external },
    })
  }

  const imageBlock = (img: DomElement): void => {
    const src = img.attribs['data-src'] || img.attribs['data-lazy-src'] || img.attribs.src || ''
    const ref = src ? ctx.image?.(src) : null
    if (!ref) {
      warnings.push(`image not migrated: ${src.slice(0, 120) || '(no src)'}`)
      return
    }
    flush()
    blocks.push({
      type: 'upload',
      version: 3,
      format: '',
      id: nodeId(),
      relationTo: 'media',
      value: ref.mediaId,
      fields: {},
    })
  }

  const iframeBlock = (frame: DomElement): void => {
    const src = frame.attribs.src ?? ''
    const id = youtubeId(src)
    flush()
    if (id) {
      blocks.push({
        type: 'block',
        version: 2,
        format: '',
        fields: {
          id: nodeId(),
          blockName: '',
          blockType: 'youtube',
          url: `https://www.youtube.com/watch?v=${id}`,
          caption: frame.attribs.title?.slice(0, 200) ?? '',
        },
      })
      return
    }
    // Google Docs/Forms embeds → a plain link (no third-party frames on the new site).
    const decision = rewriteHref(src, ctx)
    if (decision.keep) {
      blocks.push(
        element(
          'paragraph',
          [
            element('link', [text(frame.attribs.title || 'Open the document', 0)], {
              version: 3,
              fields: { linkType: 'custom', url: decision.url, newTab: true },
            }),
          ],
          { textFormat: 0, textStyle: '' },
        ),
      )
    } else warnings.push(`embed removed (${decision.reason})`)
  }

  const listNode = (list: DomElement, depth: number): Node | null => {
    const ordered = list.name.toLowerCase() === 'ol'
    const items: Node[] = []
    let value = 1
    for (const li of list.children) {
      if (!isTag(li)) continue
      if (li.name.toLowerCase() !== 'li') continue
      const nested = li.children.filter(
        (c) => isTag(c) && (c.name.toLowerCase() === 'ul' || c.name.toLowerCase() === 'ol'),
      ) as DomElement[]
      const own = li.children.filter((c) => !nested.includes(c as DomElement))
      const children = collectInline(own, 0, false)
      if (children.length) items.push(element('listitem', children, { value: value++ }))
      for (const sub of nested) {
        const subList = depth < 4 ? listNode(sub, depth + 1) : null
        if (subList) items.push(element('listitem', [subList], { value: value++ }))
      }
    }
    if (!items.length) return null
    return element('list', items, {
      listType: ordered ? 'number' : 'bullet',
      start: 1,
      tag: ordered ? 'ol' : 'ul',
    })
  }

  const walk = (n: DomNode, format: number): void => {
    if (isText(n)) {
      const value = n.data.replace(/[\t\n\r ]+/g, ' ')
      if (value) inline.push(text(value, format))
      return
    }
    if (!isTag(n)) return
    const name = n.name.toLowerCase()
    if (name === 'br') return inline.push(LINEBREAK)
    if (name === 'img') return imageBlock(n)
    if (name === 'iframe') return iframeBlock(n)
    if (name === 'hr') {
      flush()
      blocks.push({ type: 'horizontalrule', version: 1 })
      return
    }
    if (name in HEADING) {
      flush()
      const children = collectInline(n.children, 0, false)
      if (children.length) blocks.push(element('heading', children, { tag: HEADING[name] }))
      return
    }
    if (name === 'blockquote') {
      flush()
      const children = collectInline(n.children, 0, false)
      if (children.length) blocks.push(element('quote', children))
      return
    }
    if (name === 'ul' || name === 'ol') {
      flush()
      const list = listNode(n, 1)
      if (list) blocks.push(list)
      return
    }
    if (name === 'a') {
      // An image wrapped in a link (WordPress "link to media file") → just the image.
      const imgs = elementsByTag('img', n.children)
      if (imgs.length) return imgs.forEach((img) => imageBlock(img))
      const link = linkNode(n, format)
      if (link) inline.push(link)
      else n.children.forEach((c) => walk(c, format))
      return
    }
    if (BLOCK_CONTAINERS.has(name)) {
      flush()
      n.children.forEach((c) => walk(c, format))
      flush()
      return
    }
    // Inline formatting and transparent wrappers (span, font, sup, sub, …).
    const extra = INLINE_FORMAT[name] ?? 0
    n.children.forEach((c) => walk(c, format | extra))
  }

  parse(html).forEach((n) => walk(n, 0))
  flush()
  return { state: { root: element('root', blocks) }, warnings }
}

/** Upload URLs (img src/data-src) referenced by the HTML, in document order, de-duplicated. */
export function imageSources(html: string): string[] {
  const srcs = elementsByTag('img', parse(html)).map(
    (img) => img.attribs['data-src'] || img.attribs['data-lazy-src'] || img.attribs.src || '',
  )
  return [...new Set(srcs.filter(Boolean))]
}

/** Every href in the HTML (for PDF attachments and link reports). */
export function linkHrefs(html: string): string[] {
  return elementsByTag('a', parse(html))
    .map((a) => a.attribs.href ?? '')
    .filter(Boolean)
}
