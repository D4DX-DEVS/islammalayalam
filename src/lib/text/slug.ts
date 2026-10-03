/**
 * Malayalam-safe slug normalisation (audit finding: a category slug ending in ZWNJ became unreachable).
 *
 * Canonical slugs contain no invisible characters. Legacy "chillu" sequences
 * (consonant + virama + ZWJ, e.g. ര്‍) are converted to their atomic Unicode 5.1
 * chillu letters (ർ), so the visible URL stays the same while the byte sequence
 * becomes unambiguous. Article TEXT is never passed through this — only slugs/paths.
 */
const VIRAMA = '്'
const ZWJ = '‍'

const CHILLU: Record<string, string> = {
  ണ: 'ൺ', // ണ → ൺ
  ന: 'ൻ', // ന → ൻ
  ര: 'ർ', // ര → ർ
  ല: 'ൽ', // ല → ൽ
  ള: 'ൾ', // ള → ൾ
  ക: 'ൿ', // ക → ൿ
}

const LEGACY_CHILLU = new RegExp(`([${Object.keys(CHILLU).join('')}])${VIRAMA}${ZWJ}`, 'g')
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g

/** Convert legacy chillu sequences to atomic chillu letters. */
export function atomicChillu(input: string): string {
  return input.replace(LEGACY_CHILLU, (_, consonant: string) => CHILLU[consonant] ?? consonant)
}

/** Normalise one slug / path segment. Returns '' when nothing usable remains. */
export function normalizeSlug(input: string): string {
  return atomicChillu(input.normalize('NFC'))
    .replace(INVISIBLE, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Safely percent-decode a URL segment; invalid encodings return null (treated as not found). */
export function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** Normalise a full request path ("/a/b/") into canonical segments. */
export function normalizePath(pathname: string): string[] | null {
  const segments: string[] = []
  for (const raw of pathname.split('/')) {
    if (!raw) continue
    const decoded = decodeSegment(raw)
    if (decoded === null) return null
    const slug = normalizeSlug(decoded)
    if (!slug) return null
    segments.push(slug)
  }
  return segments
}

/** Join canonical segments into the site's path form ("/a/b/"). */
export const toPath = (segments: string[]): string =>
  segments.length ? `/${segments.join('/')}/` : '/'

/** Invisible-character-free, whitespace-collapsed plain text (for titles/excerpts from legacy data). */
export function cleanInlineText(input: string): string {
  return input.normalize('NFC').replace(/￼/g, '').replace(/[​⁠﻿]/g, '').replace(/\s+/g, ' ').trim()
}

/** Percent-encode each path segment for the Location header (Unicode is not valid there). */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((s) => (s ? encodeURIComponent(s) : s))
    .join('/')
}
