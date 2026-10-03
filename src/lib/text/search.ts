import { atomicChillu } from '@/lib/text/slug'

/**
 * Search normalisation. Legacy WordPress text spells chillu letters as consonant + virama + ZWJ
 * (ര്‍) while modern keyboards type the atomic letter (ർ); some text also carries stray invisible
 * joiners. Both the stored key and the visitor's query go through the same function, so either
 * spelling finds the other.
 */
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g
const CONTROL = /[\u0000-\u001F\u007F]/g

export const SEARCH_KEY_LIMIT = 2_000
export const SEARCH_QUERY = { min: 2, max: 80, maxWords: 8 } as const

export function searchNormalize(input: string): string {
  return atomicChillu(input.normalize('NFC'))
    .replace(INVISIBLE, '')
    .replace(CONTROL, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stored search key for a document: normalised title + summary, bounded. */
export function searchKey(...parts: Array<string | null | undefined>): string {
  return searchNormalize(parts.filter(Boolean).join(' ')).slice(0, SEARCH_KEY_LIMIT)
}

/** Visitor query → normalised terms, or null when too short/long to run. Never throws. */
export function parseSearchQuery(
  raw: string | string[] | undefined,
): { display: string; normalized: string } | null {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  const display = value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, SEARCH_QUERY.max)
  const words = searchNormalize(display).split(' ').filter(Boolean).slice(0, SEARCH_QUERY.maxWords)
  const normalized = words.join(' ')
  if ([...normalized].length < SEARCH_QUERY.min) return null
  return { display, normalized }
}
