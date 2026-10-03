import sanitizeHtml from 'sanitize-html'
import { findIocs as auditIocs, sanitizeContent } from '../../audit/lib/sanitize.mjs'
import { findIocs as appIocs } from '@/lib/security/ioc'

/**
 * Gate A — text. Order matters:
 *  1. known-variant removal (audit sanitizer: the loader stubs, the PHP hook, trailers, any <script>)
 *  2. strict allowlist (sanitize-html): only structural/formatting tags, no attributes except the
 *     few the transform needs, no `javascript:`/`data:`, iframes only from YouTube / Google Docs
 *  3. IOC scan with BOTH rule sets (audit + app) — anything left means the record is rejected.
 * The output is still only an intermediate: it is converted to Lexical nodes (never stored as HTML).
 */
export type GateResult =
  | { ok: true; html: string; removed: Record<string, number> }
  | { ok: false; iocs: string[] }

export const IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'docs.google.com',
]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'sup',
    'sub',
    'span',
    'font',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
    'img',
    'iframe',
    'figure',
    'figcaption',
    'div',
    'section',
    'article',
    'aside',
    'center',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    'caption',
  ],
  allowedAttributes: {
    a: ['href'],
    img: ['src', 'alt', 'srcset', 'data-src', 'data-lazy-src', 'width', 'height'],
    iframe: ['src', 'title'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'http'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  // Disallowed tags are dropped but their text is kept; these are dropped WITH their content.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'object', 'embed'],
  disallowedTagsMode: 'discard',
  parser: { decodeEntities: true },
}

export function gateHtml(raw: string): GateResult {
  const known = sanitizeContent(raw ?? '')
  if (known.residualIocs.length) return { ok: false, iocs: known.residualIocs }
  const html = sanitizeHtml(known.clean, OPTIONS).replace(/￼/g, '')
  const iocs = [...new Set([...auditIocs(html), ...appIocs(html)])]
  if (iocs.length) return { ok: false, iocs }
  return { ok: true, html, removed: known.removed as Record<string, number> }
}
