import { describe, expect, it } from 'vitest'
import { parseSearchQuery, searchKey, searchNormalize, SEARCH_QUERY } from '@/lib/text/search'

const LEGACY = 'ഖുര്‍ആന്‍' // ഖുര്‍ആന്‍ — how WordPress stored it
const ATOMIC = 'ഖുർആൻ' // ഖുർആൻ — what a phone keyboard types

describe('searchNormalize', () => {
  it('maps legacy chillu spellings onto the atomic letters', () => {
    expect(searchNormalize(LEGACY)).toBe(ATOMIC)
    expect(searchNormalize(`${LEGACY} പഠനം`)).toBe(searchNormalize(`${ATOMIC} പഠനം`))
  })

  it('drops invisible joiners, lowercases Latin and collapses whitespace', () => {
    expect(searchNormalize('ഇസ്‌ലാം')).toBe('ഇസ്ലാം')
    expect(searchNormalize('  Islam​   MALAYALAM\n')).toBe('islam malayalam')
  })

  it('bounds the stored key', () => {
    expect(searchKey('a'.repeat(5000)).length).toBe(2000)
    expect(searchKey('Title', null, undefined, 'Summary')).toBe('title summary')
  })
})

describe('parseSearchQuery', () => {
  it('rejects empty and one-letter queries', () => {
    for (const q of [undefined, '', '   ', 'a', 'ക']) expect(parseSearchQuery(q)).toBeNull()
  })

  it('keeps the display text, normalises the terms, and caps length and word count', () => {
    expect(parseSearchQuery(`  ${LEGACY}\u0000  `)).toEqual({ display: LEGACY, normalized: ATOMIC })
    expect(parseSearchQuery('x'.repeat(500))!.display).toHaveLength(SEARCH_QUERY.max)
    expect(parseSearchQuery('a1 b2 c3 d4 e5 f6 g7 h8 i9 j10')!.normalized.split(' ')).toHaveLength(
      SEARCH_QUERY.maxWords,
    )
    expect(parseSearchQuery(['first', 'second'])!.display).toBe('first')
  })
})
