/**
 * Small helpers for Lexical (rich-text) documents. Pure, so they are unit-tested.
 */
type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }
type LexicalDoc = { root?: { children?: LexicalNode[] } & Record<string, unknown> }

/** The text of a node and everything inside it. */
export function plainText(node: LexicalNode | null | undefined): string {
  if (!node) return ''
  return (node.text ?? '') + (node.children ?? []).map(plainText).join('')
}

/**
 * Compare titles the way a reader would: ignore case, spacing, trailing punctuation and the
 * zero-width joiners Malayalam text uses (ഇസ്‌ലാം is typed with and without them).
 */
function normalizeTitle(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.:;,!?"'“”‘’()\-–—|]+$/g, '')
    .trim()
    .toLowerCase()
}

/**
 * The page heading is already shown above the body, so a body that starts with the same heading
 * (as the imported pages do) would repeat it. Returns the document without that first heading;
 * anything else — a different heading, a paragraph, no match — is returned unchanged.
 */
export function withoutLeadingTitle<T>(data: T, title: string | null | undefined): T {
  const wanted = normalizeTitle(title ?? '')
  const root = (data as LexicalDoc | null | undefined)?.root
  const children = root?.children
  if (!wanted || !root || !Array.isArray(children)) return data
  // Skip blank paragraphs the editor may have left above the heading.
  const at = children.findIndex((n) => !(n.type === 'paragraph' && !plainText(n).trim()))
  const first = children[at]
  if (!first || first.type !== 'heading' || normalizeTitle(plainText(first)) !== wanted) return data
  return { ...(data as object), root: { ...root, children: children.slice(at + 1) } } as T
}

/** True when the document has at least one block. */
export function hasBlocks(data: unknown): boolean {
  const children = (data as LexicalDoc | null | undefined)?.root?.children
  return Array.isArray(children) && children.length > 0
}
