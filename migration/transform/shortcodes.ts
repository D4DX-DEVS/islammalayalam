import { youtubeId } from '@/lib/security/url'
import { htmlToText } from '../lib/text'

/**
 * WordPress page bodies are raw WPBakery / tagDiv shortcodes (the builder never ran for the REST
 * API), with wptexturize "smart quotes" as attribute delimiters. This turns them into the CMS page
 * model: body HTML + titled sections (the tabs / accordions). Builder layout (rows, columns,
 * colours) is dropped; sub-menus are dropped (a page lists its sub-pages itself); raw-HTML blocks
 * are never trusted and are dropped. The HTML produced here still goes through Gate A.
 */
export type PageSection = { title: string; html: string }
export type PageModel = { body: string; sections: PageSection[]; warnings: string[] }

type ScNode = { name: string; attrs: Record<string, string>; children: Array<ScNode | string> }

/** Only builder shortcodes are parsed; any other "[…]" in the text stays text. */
const BUILDER = /^(?:vc|td|accordion|featured|wpfd)_[a-z0-9_]*$/
const TAG = /\[(\/)?([a-z][a-z0-9_]*)([^\]]*)\]/gi
const SELF_CLOSING = new Set([
  'vc_wp_custommenu',
  'td_block_list_menu',
  'td_block_ad_box',
  'vc_video',
  'featured_cat',
  'vc_text_separator',
  'wpfd_search',
  'vc_empty_space',
  'vc_separator',
  'vc_single_image',
  'vc_btn',
])
/** Navigation widgets: the new page shows its sub-pages itself. */
const MENUS = new Set(['vc_wp_custommenu', 'td_block_list_menu'])
const SECTIONS = new Set(['vc_tta_section', 'accordion_son'])
const LAYOUT = new Set([
  'vc_row',
  'vc_column',
  'vc_row_inner',
  'vc_column_inner',
  'vc_column_text',
  'vc_tta_tabs',
  'vc_tta_accordion',
  'vc_tta_tour',
  'accordion_father',
])
const QUOTE = /&#822[01];|&#8243;|&#8222;|&quot;|[“”″„]/g

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of raw.replace(QUOTE, '"').matchAll(/([a-z_][a-z0-9_-]*)\s*=\s*"([^"]*)"/gi))
    attrs[m[1]!.toLowerCase()] = m[2]!
  return attrs
}

export function parseShortcodes(src: string): ScNode {
  const root: ScNode = { name: '#root', attrs: {}, children: [] }
  const stack: ScNode[] = [root]
  let last = 0
  for (const m of src.matchAll(TAG)) {
    const name = m[2]!.toLowerCase()
    if (!BUILDER.test(name)) continue
    const top = stack[stack.length - 1]!
    if (m.index > last) top.children.push(src.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1]) {
      // Close: pop back to the matching open tag (auto-closing anything left open inside it).
      let i = stack.length - 1
      while (i > 0 && stack[i]!.name !== name) i--
      if (i > 0) stack.length = i
      continue
    }
    const node: ScNode = { name, attrs: parseAttrs(m[3] ?? ''), children: [] }
    top.children.push(node)
    if (!SELF_CLOSING.has(name)) stack.push(node)
  }
  stack[stack.length - 1]!.children.push(src.slice(last))
  return root
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Attribute text (entities decoded, tags dropped). */
const attrText = (v: string | undefined): string => htmlToText(v ?? '')

export function pageModel(html: string): PageModel {
  const warnings = new Set<string>()
  const sections: PageSection[] = []
  const body = { html: '' }

  const render = (node: ScNode | string, out: { html: string }, inSection: boolean): void => {
    if (typeof node === 'string') {
      out.html += node
      return
    }
    const children = () => node.children.forEach((c) => render(c, out, inSection))
    if (node.name === '#root' || LAYOUT.has(node.name)) return children()
    if (SECTIONS.has(node.name)) {
      const title = attrText(node.attrs.title).slice(0, 120)
      if (inSection || !title) {
        // A tab inside a tab (or without a title) becomes a heading in the current flow.
        if (title) out.html += `<h3>${escapeHtml(title)}</h3>`
        return children()
      }
      const section = { html: '' }
      node.children.forEach((c) => render(c, section, true))
      if (htmlToText(section.html) || /<img\b|<iframe\b/i.test(section.html))
        sections.push({ title, html: section.html })
      else warnings.add('empty tab removed') // no title: report text never carries site text
      return
    }
    if (node.name === 'vc_headings') {
      const title = attrText(node.attrs.title)
      if (title)
        out.html += `<${inSection ? 'h3' : 'h2'}>${escapeHtml(title)}</${inSection ? 'h3' : 'h2'}>`
      return children()
    }
    if (node.name === 'vc_video') {
      const id = node.attrs.link ? youtubeId(attrText(node.attrs.link)) : null
      if (id) out.html += `<iframe src="https://www.youtube.com/embed/${id}"></iframe>`
      else warnings.add('video element without a YouTube link removed')
      return
    }
    if (MENUS.has(node.name)) return
    if (node.name === 'vc_raw_html') {
      warnings.add('raw HTML block removed (never trusted)')
      return
    }
    warnings.add(`builder element "${node.name}" removed`)
  }

  render(parseShortcodes(html), body, false)
  if (sections.length > 12) warnings.add(`${sections.length} tabs; only the first 12 kept`)
  return { body: body.html, sections: sections.slice(0, 12), warnings: [...warnings] }
}
