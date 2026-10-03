import { DomUtils, parseDocument } from 'htmlparser2'

/**
 * Text helpers for WordPress "rendered" strings (titles, excerpts): entities decoded, tags dropped.
 * Malayalam joiners (ZWJ/ZWNJ) are content and are kept; U+FFFC (object replacement, found next to
 * injection points) is removed.
 */
const OBJECT_REPLACEMENT = /￼/g

export function htmlToText(html: string): string {
  if (!html) return ''
  const doc = parseDocument(html, { decodeEntities: true })
  return DomUtils.textContent(doc)
    .replace(OBJECT_REPLACEMENT, '')
    .replace(/[\s ]+/g, ' ')
    .trim()
}

/** Cut at a word boundary, adding an ellipsis when shortened. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

const QUOTES_AT_START = /^[“”"‘’'«»]+/u
const QUOTES_AT_END = /[“”"‘’'«»]+$/u

/**
 * Title for an untitled post: its first sentence (Malayalam sentences end with . ? ! or ।).
 * Q&A posts start "Question: “…?” Answer: …" → the question itself; a heading line ended by
 * "=====" or " | " (video descriptions) is used as it is.
 */
export function deriveTitle(bodyText: string, max = 90): string {
  const text = (
    bodyText
      .trim()
      .replace(/^(?:question|ചോദ്യം)\s*:\s*/iu, '')
      .split(/\s*={3,}\s*|\s+\|\s+|\s*(?:answer|ഉത്തരം)\s*:/iu)[0] ?? ''
  )
    .replace(QUOTES_AT_START, '')
    .trim()
  if (!text) return ''
  // Legacy text mixes up opening and closing quotes, so any quote mark may close a sentence.
  const sentence = /^(.{12,}?[.?!।])(?=[“”"‘’'«»]*(?:\s|$))/u.exec(text)?.[1] ?? text
  return clip(sentence.replace(/[.।]$/u, '').replace(QUOTES_AT_END, ''), max)
}

/** Card/SEO summary: the WordPress excerpt if it says something, else the start of the body. */
export function summary(excerptHtml: string, bodyText: string, max = 280): string {
  const excerpt = htmlToText(excerptHtml)
    .replace(/\s*(?:\[(?:…|&hellip;|\.\.\.)\]|…)\s*$/u, '')
    .trim()
  return clip(excerpt.length >= 20 ? excerpt : bodyText, max)
}
