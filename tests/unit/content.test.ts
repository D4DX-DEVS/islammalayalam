import { describe, expect, it } from 'vitest'
import { lexicalToPlainText, validateLexical } from '@/lib/security/lexical-guard'
import { inspectDocument, RICH_TEXT_BLOCKS } from '@/payload/hooks/contentGuard'

type Node = Record<string, unknown>
const text = (t: string): Node => ({ type: 'text', text: t, format: 0, version: 1 })
const para = (...children: Node[]): Node => ({ type: 'paragraph', children, version: 1 })
const doc = (...children: Node[]) => ({ root: { type: 'root', children, version: 1 } })
const link = (fields: Record<string, unknown>): Node => ({
  type: 'link',
  fields,
  children: [text('x')],
  version: 1,
})

describe('validateLexical', () => {
  it('accepts ordinary rich text', () => {
    const state = doc(
      para(text('ഇസ്‌ലാം')),
      { type: 'heading', tag: 'h2', children: [text('h')] },
      { type: 'list', children: [{ type: 'listitem', children: [text('i')] }] },
    )
    expect(validateLexical(state, RICH_TEXT_BLOCKS)).toEqual([])
  })

  it('rejects node types outside the allowlist (raw HTML, code, embeds)', () => {
    const v = validateLexical(
      doc({ type: 'html', html: '<b>x</b>' }, { type: 'code', children: [] }),
      RICH_TEXT_BLOCKS,
    )
    expect(v.map((x) => x.reason)).toEqual(
      expect.arrayContaining(['node type "html" not allowed', 'node type "code" not allowed']),
    )
  })

  it('rejects unsafe custom links and internal links to non-content collections', () => {
    expect(
      validateLexical(
        doc(para(link({ linkType: 'custom', url: 'javascript:alert(1)' }))),
        RICH_TEXT_BLOCKS,
      ),
    ).toHaveLength(2) // unsafe URL + IOC scan
    expect(
      validateLexical(
        doc(para(link({ linkType: 'internal', doc: { relationTo: 'users', value: 'x' } }))),
        RICH_TEXT_BLOCKS,
      )[0]?.reason,
    ).toMatch(/internal link to "users"/)
    expect(
      validateLexical(doc(para(link({ linkType: 'weird', url: '/x/' }))), RICH_TEXT_BLOCKS)[0]
        ?.reason,
    ).toMatch(/link type/)
    expect(
      validateLexical(
        doc(para(link({ linkType: 'custom', url: 'https://example.org' }))),
        RICH_TEXT_BLOCKS,
      ),
    ).toEqual([])
  })

  it('rejects uploads to other collections and unknown blocks', () => {
    expect(
      validateLexical(doc({ type: 'upload', relationTo: 'users', value: 'x' }), RICH_TEXT_BLOCKS)[0]
        ?.reason,
    ).toMatch(/upload to "users"/)
    expect(
      validateLexical(doc({ type: 'block', fields: { blockType: 'rawHtml' } }), RICH_TEXT_BLOCKS)[0]
        ?.reason,
    ).toMatch(/block "rawHtml"/)
    expect(
      validateLexical(
        doc({
          type: 'block',
          fields: { blockType: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' },
        }),
        RICH_TEXT_BLOCKS,
      ),
    ).toEqual([])
  })

  it('finds IOCs anywhere in the state, including hidden fields', () => {
    const v = validateLexical(
      doc(para({ ...text('ok'), style: 'x', $: { note: 'xdav_tracker' } })),
      RICH_TEXT_BLOCKS,
    )
    expect(v.some((x) => x.reason.includes('xdav_hook'))).toBe(true)
  })

  it('bounds nesting depth', () => {
    let node: Node = text('deep')
    for (let i = 0; i < 60; i++) node = { type: 'quote', children: [node] }
    expect(
      validateLexical(doc(node), RICH_TEXT_BLOCKS).some((x) => x.reason === 'nesting too deep'),
    ).toBe(true)
  })

  it('extracts plain text for search', () => {
    expect(lexicalToPlainText(doc(para(text('ഒന്ന്')), para(text('two'))))).toBe('ഒന്ന്\ntwo')
  })
})

describe('inspectDocument (collection/global write guard)', () => {
  it('scans every string and every Lexical state in a document', () => {
    const v = inspectDocument({
      title: 'ok',
      excerpt: '<script>x</script>',
      content: doc(para(text('fine'))),
      nested: [{ caption: 'securityalertcaptchacheck.com' }],
    })
    expect(v.map((x) => x.path)).toEqual(expect.arrayContaining(['excerpt', 'nested[0].caption']))
  })

  it('checks every href-bearing field (url, …Url) regardless of draft state', () => {
    const v = inspectDocument({
      audio: { url: 'data:text/html,x' },
      partnerUrl: 'vbscript:x',
      menu: [{ link: { url: '/ok/' } }],
      name: 'data:not-a-url-field',
    })
    expect(
      v
        .filter((x) => x.reason.startsWith('unsafe URL'))
        .map((x) => x.path)
        .sort(),
    ).toEqual(['audio.url', 'partnerUrl'])
  })

  it('never inspects password fields and accepts clean documents', () => {
    expect(inspectDocument({ password: '<script>', title: 'ഖുര്‍ആന്‍' })).toEqual([])
  })
})
