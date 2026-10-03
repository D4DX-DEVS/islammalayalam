import { APIError } from 'payload'
import type { CollectionBeforeValidateHook, GlobalBeforeValidateHook } from 'payload'
import { findIocs } from '@/lib/security/ioc'
import { validateLexical, type GuardViolation } from '@/lib/security/lexical-guard'
import { isSafeHref } from '@/lib/security/url'

/**
 * Content-integrity guard — runs before validation on EVERY write (editors and migration alike).
 * Walks the whole incoming document: every Lexical state is validated against the node/link/block
 * allowlists; every string is scanned for indicators of compromise. Any hit rejects the write.
 */
export const RICH_TEXT_BLOCKS: ReadonlySet<string> = new Set(['youtube', 'pdfAttachment'])
const SKIP_KEYS = new Set(['password', 'confirm-password', 'totpSecret', 'hash', 'salt'])
const MAX_WALK = 50_000
// Field names that hold hrefs: `url` (links, video, audio) and `…Url` (partnerUrl).
const URL_KEY = /^(?:url|[a-z]+Url)$/

function isLexicalState(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'root' in (value as object) &&
      typeof (value as { root: unknown }).root === 'object',
  )
}

export function inspectDocument(data: unknown): GuardViolation[] {
  const violations: GuardViolation[] = []
  let visited = 0
  const walk = (value: unknown, path: string): void => {
    if (++visited > MAX_WALK) return
    if (typeof value === 'string') {
      const iocs = findIocs(value)
      if (iocs.length)
        violations.push({ path, reason: `malicious content indicators: ${iocs.join(', ')}` })
      // URL-bearing fields are re-checked here because Payload skips field validators on drafts.
      if (value && URL_KEY.test(path.slice(path.lastIndexOf('.') + 1)) && !isSafeHref(value)) {
        violations.push({ path, reason: 'unsafe URL (only site paths, https/http, mailto, tel)' })
      }
      return
    }
    if (!value || typeof value !== 'object') return
    if (isLexicalState(value)) {
      for (const v of validateLexical(value, RICH_TEXT_BLOCKS))
        violations.push({ path: `${path}${v.path.slice(1)}`, reason: v.reason })
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    for (const [key, child] of Object.entries(value)) {
      if (!SKIP_KEYS.has(key)) walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(data, '')
  return violations
}

function reject(violations: GuardViolation[], target: string): never {
  const summary = violations
    .slice(0, 5)
    .map((v) => `${v.path || '(document)'}: ${v.reason}`)
    .join('; ')
  throw new APIError(
    `Content rejected by integrity guard (${target}): ${summary}`,
    400,
    { violations: violations.slice(0, 50) },
    true,
  )
}

export const guardCollectionContent: CollectionBeforeValidateHook = ({ data, collection }) => {
  const violations = inspectDocument(data)
  if (violations.length) reject(violations, collection.slug)
  return data
}

export const guardGlobalContent: GlobalBeforeValidateHook = ({ data, global }) => {
  const violations = inspectDocument(data)
  if (violations.length) reject(violations, global.slug)
  return data
}
