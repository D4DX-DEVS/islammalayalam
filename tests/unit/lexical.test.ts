import { describe, expect, it } from 'vitest'
import { hasBlocks, plainText, withoutLeadingTitle } from '@/lib/text/lexical'

const text = (value: string) => ({ type: 'text', text: value })
const heading = (value: string, tag = 'h2') => ({ type: 'heading', tag, children: [text(value)] })
const paragraph = (value = '') => ({ type: 'paragraph', children: value ? [text(value)] : [] })
const doc = (...children: unknown[]) => ({ root: { type: 'root', version: 1, children } })

describe('withoutLeadingTitle', () => {
  it('drops a first heading that repeats the title', () => {
    const out = withoutLeadingTitle(doc(heading('നബിചരിതം'), paragraph('body')), 'നബിചരിതം')
    expect(out.root.children).toEqual([paragraph('body')])
  })

  it('ignores case, spacing, trailing punctuation and zero-width joiners', () => {
    expect(
      withoutLeadingTitle(doc(heading('  About   US: '), paragraph('x')), 'about us').root.children,
    ).toHaveLength(1)
    expect(
      withoutLeadingTitle(doc(heading('ഇസ്‌ലാം'), paragraph('x')), 'ഇസ്ലാം').root.children,
    ).toHaveLength(1)
  })

  it('matches headings nested in formatting (bold text) and any heading level', () => {
    const nested = {
      type: 'heading',
      tag: 'h3',
      children: [{ type: 'text', text: 'ആദര്‍ശം', format: 1 }],
    }
    expect(withoutLeadingTitle(doc(nested, paragraph('x')), 'ആദര്‍ശം').root.children).toHaveLength(
      1,
    )
  })

  it('looks past blank paragraphs above the heading and drops them with it', () => {
    const out = withoutLeadingTitle(doc(paragraph(), heading('Title'), paragraph('x')), 'Title')
    expect(out.root.children).toEqual([paragraph('x')])
  })

  it('keeps a different heading, a paragraph, or a repeat further down', () => {
    const different = doc(heading('കുടുംബം'), paragraph('x'))
    expect(withoutLeadingTitle(different, 'ചരിത്രം')).toBe(different)
    const startsWithText = doc(paragraph('Title'), paragraph('x'))
    expect(withoutLeadingTitle(startsWithText, 'Title')).toBe(startsWithText)
    const later = doc(paragraph('intro'), heading('Title'))
    expect(withoutLeadingTitle(later, 'Title')).toBe(later)
  })

  it('does not match partial titles', () => {
    const partial = doc(heading('Quran translation'), paragraph('x'))
    expect(withoutLeadingTitle(partial, 'Quran')).toBe(partial)
  })

  it('does not mutate its input and leaves other root fields alone', () => {
    const input = doc(heading('T'), paragraph('x'))
    const out = withoutLeadingTitle(input, 'T')
    expect(input.root.children).toHaveLength(2)
    expect(out.root).toMatchObject({ type: 'root', version: 1 })
  })

  it('is safe with empty, missing or malformed input', () => {
    expect(withoutLeadingTitle(null, 'T')).toBeNull()
    expect(withoutLeadingTitle(undefined, 'T')).toBeUndefined()
    expect(withoutLeadingTitle({}, 'T')).toEqual({})
    const d = doc(heading('T'))
    expect(withoutLeadingTitle(d, '')).toBe(d)
    expect(withoutLeadingTitle(d, null)).toBe(d)
    expect(hasBlocks(withoutLeadingTitle(d, 'T'))).toBe(false)
  })
})

describe('plainText / hasBlocks', () => {
  it('joins nested text', () => {
    expect(plainText({ children: [text('a'), { children: [text('b')] }] })).toBe('ab')
    expect(plainText(null)).toBe('')
  })

  it('reports whether a document has blocks', () => {
    expect(hasBlocks(doc(paragraph('x')))).toBe(true)
    expect(hasBlocks(doc())).toBe(false)
    expect(hasBlocks(null)).toBe(false)
  })
})
