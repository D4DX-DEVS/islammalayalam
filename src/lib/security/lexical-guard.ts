import { findIocs } from './ioc'
import { isSafeHref } from './url'

/**
 * Validates a serialized Lexical editor state before it is stored.
 * Runs on EVERY write (editor or migration): node-type allowlist, link-scheme allowlist,
 * block allowlist, upload target allowlist, and an IOC scan over the whole document.
 */
const ALLOWED_NODE_TYPES = new Set([
  'root',
  'paragraph',
  'text',
  'linebreak',
  'tab',
  'heading',
  'quote',
  'list',
  'listitem',
  'link',
  'autolink',
  'upload',
  'horizontalrule',
  'block',
])
const ALLOWED_UPLOAD_COLLECTIONS = new Set(['media'])
const ALLOWED_LINK_COLLECTIONS = new Set(['posts', 'pages', 'categories'])
const MAX_DEPTH = 40
const MAX_NODES = 20_000

export type GuardViolation = { path: string; reason: string }

type LexicalNode = {
  type?: unknown
  children?: unknown
  fields?: Record<string, unknown>
  relationTo?: unknown
  [key: string]: unknown
}

export function validateLexical(
  state: unknown,
  allowedBlocks: ReadonlySet<string>,
): GuardViolation[] {
  const violations: GuardViolation[] = []
  if (state === null || state === undefined) return violations
  if (typeof state !== 'object' || !('root' in state)) {
    return [{ path: '$', reason: 'not a Lexical editor state' }]
  }
  let count = 0
  const walk = (node: LexicalNode, path: string, depth: number): void => {
    if (++count > MAX_NODES) {
      if (count === MAX_NODES + 1) violations.push({ path, reason: 'document too large' })
      return
    }
    if (depth > MAX_DEPTH) {
      violations.push({ path, reason: 'nesting too deep' })
      return
    }
    const type = typeof node.type === 'string' ? node.type : ''
    if (!ALLOWED_NODE_TYPES.has(type))
      violations.push({ path, reason: `node type "${type}" not allowed` })
    if (type === 'link' || type === 'autolink') {
      const fields = node.fields ?? {}
      const linkType = fields.linkType ?? 'custom'
      if (linkType === 'custom') {
        if (!isSafeHref(fields.url)) violations.push({ path, reason: 'unsafe link URL' })
      } else if (linkType === 'internal') {
        const target = (fields.doc as { relationTo?: unknown } | undefined)?.relationTo
        if (!ALLOWED_LINK_COLLECTIONS.has(String(target)))
          violations.push({ path, reason: `internal link to "${String(target)}" not allowed` })
      } else violations.push({ path, reason: `link type "${String(linkType)}" not allowed` })
    }
    if (type === 'upload' && !ALLOWED_UPLOAD_COLLECTIONS.has(String(node.relationTo))) {
      violations.push({ path, reason: `upload to "${String(node.relationTo)}" not allowed` })
    }
    if (type === 'block') {
      const blockType = String(node.fields?.blockType ?? '')
      if (!allowedBlocks.has(blockType))
        violations.push({ path, reason: `block "${blockType}" not allowed` })
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, i) => {
        if (child && typeof child === 'object')
          walk(child as LexicalNode, `${path}.children[${i}]`, depth + 1)
        else violations.push({ path: `${path}.children[${i}]`, reason: 'invalid child' })
      })
    }
  }
  walk((state as { root: LexicalNode }).root, '$.root', 0)
  const iocs = findIocs(JSON.stringify(state))
  if (iocs.length)
    violations.push({ path: '$', reason: `malicious content indicators: ${iocs.join(', ')}` })
  return violations
}

/** Plain text of a Lexical state (for search indexing, excerpts, reading time). */
export function lexicalToPlainText(state: unknown, limit = 200_000): string {
  const out: string[] = []
  let size = 0
  const walk = (node: LexicalNode): void => {
    if (size > limit) return
    if (node.type === 'text' && typeof node.text === 'string') {
      out.push(node.text)
      size += node.text.length
    }
    if (node.type === 'linebreak') out.push('\n')
    if (Array.isArray(node.children)) {
      for (const child of node.children)
        if (child && typeof child === 'object') walk(child as LexicalNode)
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listitem' ||
        node.type === 'quote'
      )
        out.push('\n')
    }
  }
  if (state && typeof state === 'object' && 'root' in state)
    walk((state as { root: LexicalNode }).root)
  return out
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit)
}
