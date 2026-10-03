import { describe, expect, it } from 'vitest'
import {
  atomicChillu,
  cleanInlineText,
  decodeSegment,
  normalizePath,
  normalizeSlug,
  toPath,
} from '@/lib/text/slug'

const ZWJ = '‍'
const ZWNJ = '‌'
const VIRAMA = '്'

describe('normalizeSlug', () => {
  it('converts legacy chillu (consonant + virama + ZWJ) to atomic chillu', () => {
    const legacy = `ആദര${VIRAMA}${ZWJ}ശം` // how WordPress stored /ആദര്‍ശം/
    expect(atomicChillu(legacy)).toBe('ആദർശം')
    expect(normalizeSlug(legacy)).toBe('ആദർശം')
  })

  it('strips invisible characters (the ZWNJ that made a category unreachable)', () => {
    expect(normalizeSlug(`കാഴ്ചപ്പാട്${ZWNJ}`)).toBe('കാഴ്ചപ്പാട്')
    expect(normalizeSlug('​news﻿')).toBe('news')
  })

  it('lower-cases Latin, hyphenates whitespace/underscores, drops punctuation', () => {
    expect(normalizeSlug('  Guide & Tips_2024 ')).toBe('guide-tips-2024')
    expect(normalizeSlug('a -- b')).toBe('a-b')
    expect(normalizeSlug('<script>')).toBe('script')
  })

  it('applies NFC so different byte sequences of the same text agree', () => {
    expect(normalizeSlug('é')).toBe(normalizeSlug('é'))
  })

  it('returns empty string when nothing usable remains', () => {
    expect(normalizeSlug(`${ZWJ}${ZWNJ} ---`)).toBe('')
  })
})

describe('paths', () => {
  it('decodes, normalises and rejects bad encodings', () => {
    expect(normalizePath(`/${encodeURIComponent(`ആദര${VIRAMA}${ZWJ}ശം`)}/വിശ്വാസം/`)).toEqual([
      'ആദർശം',
      'വിശ്വാസം',
    ])
    expect(normalizePath('/%E0%A4%A/')).toBeNull()
    expect(normalizePath('/ok/%E2%80%8B/')).toBeNull() // a segment that is only invisible chars
    expect(decodeSegment('%zz')).toBeNull()
  })

  it('formats canonical paths with the WordPress trailing slash', () => {
    expect(toPath(['category', 'news'])).toBe('/category/news/')
    expect(toPath([])).toBe('/')
  })
})

describe('cleanInlineText', () => {
  it('keeps ZWJ inside text (old-style chillu rendering) but removes U+FFFC and zero-width spaces', () => {
    expect(cleanInlineText(`ര${VIRAMA}${ZWJ} ￼  a​b`)).toBe(`ര${VIRAMA}${ZWJ} ab`)
  })
})
