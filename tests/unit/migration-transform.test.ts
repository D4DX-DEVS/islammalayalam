import { describe, expect, it } from 'vitest'
import { validateLexical } from '@/lib/security/lexical-guard'
import { gateHtml } from '../../migration/gates/html'
import { isDemoPost, isSuspectDate } from '../../migration/lib/exclusions'
import { deriveTitle, htmlToText, summary } from '../../migration/lib/text'
import { originalUploadUrl, rewriteHref } from '../../migration/transform/links'
import { htmlToLexical, imageSources } from '../../migration/transform/lexical'
import { pagePaths, repairedDate, toIso } from '../../migration/transform/paths'
import { firstContentImage, mediaNeeds } from '../../migration/load/posts'

const BLOCKS = new Set(['youtube', 'pdfAttachment'])
const convert = (html: string, image?: (src: string) => { mediaId: string } | null) => {
  const gate = gateHtml(html)
  if (!gate.ok) throw new Error(`rejected: ${gate.iocs.join(',')}`)
  return htmlToLexical(gate.html, { seed: 'test:1', image })
}
type N = { type: string; children?: N[]; text?: string; format?: number; [k: string]: unknown }
const root = (html: string, image?: (src: string) => { mediaId: string } | null) =>
  convert(html, image).state.root as N

describe('Gate A — HTML allowlist + indicators', () => {
  it('removes scripts, handlers, styles and unsafe URLs, keeping the text', () => {
    const gate = gateHtml(
      '<p onclick="x()" style="color:red">Hi <a href="javascript:alert(1)">there</a></p><script>bad()</script><style>p{}</style>',
    )
    expect(gate.ok).toBe(true)
    if (!gate.ok) return
    expect(gate.html).toBe('<p>Hi <a>there</a></p>')
  })

  it('keeps YouTube / Google Docs frames only', () => {
    const gate = gateHtml(
      '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><iframe src="https://attacker.invalid/x"></iframe>',
    )
    expect(gate.ok && gate.html).toBe(
      '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><iframe></iframe>',
    )
  })

  it('rejects a record when an indicator survives cleaning', () => {
    const gate = gateHtml('<p>visit interseq.at today</p>')
    expect(gate).toEqual({ ok: false, iocs: expect.arrayContaining(['interseq']) })
  })
})

describe('HTML → Lexical', () => {
  it('builds paragraphs, formatting, line breaks and headings (h1 → h2)', () => {
    const r = root('<h1>Title</h1><p>a <strong>b <em>c</em></strong><br>d</p><h5>x</h5>')
    expect(r.children!.map((c) => [c.type, c.tag])).toEqual([
      ['heading', 'h2'],
      ['paragraph', undefined],
      ['heading', 'h4'],
    ])
    const p = r.children![1]!.children!
    expect(p.map((n) => [n.type, n.text, n.format])).toEqual([
      ['text', 'a ', 0],
      ['text', 'b ', 1],
      ['text', 'c', 3],
      ['linebreak', undefined, undefined],
      ['text', 'd', 0],
    ])
  })

  it('keeps Malayalam joiners but drops U+FFFC and empty paragraphs', () => {
    const r = root('<p>ഖുര്‍ആന്‍￼</p><p>&nbsp;</p><p> </p>')
    expect(r.children).toHaveLength(1)
    expect(r.children![0]!.children![0]!.text).toBe('ഖുര്‍ആന്‍')
  })

  it('turns lists (incl. nested) into list/listitem nodes', () => {
    const r = root('<ul><li>one<ul><li>inner</li></ul></li><li>two</li></ul><ol><li>x</li></ol>')
    const [ul, ol] = r.children!
    expect(ul!.listType).toBe('bullet')
    expect(ul!.children!.map((li) => li.children![0]!.type)).toEqual(['text', 'list', 'text'])
    expect(ol!.listType).toBe('number')
  })

  it('makes images upload nodes (outside paragraphs) and drops unknown ones with a warning', () => {
    const { state, warnings } = convert(
      '<p>before <img src="https://islammalayalam.net/wp-content/uploads/a.jpg"> after</p><p><img src="https://campusalive.in/x.jpg"></p>',
      (src) => (src.includes('uploads/a.jpg') ? { mediaId: 'm1' } : null),
    )
    const kids = (state.root as N).children!
    expect(kids.map((k) => k.type)).toEqual(['paragraph', 'upload', 'paragraph'])
    expect(kids[1]).toMatchObject({ relationTo: 'media', value: 'm1', version: 3 })
    expect(warnings.some((w) => w.includes('campusalive'))).toBe(true)
  })

  it('YouTube frames become youtube blocks; other embeds become links', () => {
    const r = root(
      '<iframe src="https://www.youtube.com/embed/abcdefghijk" title="Talk"></iframe><iframe src="https://docs.google.com/forms/d/e/x/viewform" title="Form"></iframe>',
    )
    expect(r.children![0]).toMatchObject({
      type: 'block',
      fields: { blockType: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
    })
    expect(r.children![1]!.children![0]).toMatchObject({
      type: 'link',
      fields: { url: 'https://docs.google.com/forms/d/e/x/viewform', newTab: true },
    })
  })

  it('rewrites own-site links to site paths and unwraps dead ones', () => {
    const r = root(
      '<p><a href="http://islammalayalam.net/?p=123">post</a> <a href="https://www.campusalive.in/x">dead</a> <a href="http://hajj.islamonlive.in/a">ext</a> <a href="https://unknown-site.example/">other</a></p>',
    )
    const p = r.children![0]!.children!
    expect(p[0]).toMatchObject({ type: 'link', fields: { url: '/123/', newTab: false } })
    expect(p[1]).toMatchObject({ type: 'text', text: ' dead ' })
    expect(p[2]).toMatchObject({ type: 'link', fields: { url: 'https://hajj.islamonlive.in/a' } })
    expect(p[3]).toMatchObject({ type: 'text', text: ' other' }) // not approved → text only
  })

  it('output always passes the CMS content guard and is stable across runs', () => {
    const html =
      '<div><h2>H</h2><blockquote><p>q1</p><p>q2</p></blockquote><table><tr><td>cell</td></tr></table><hr><p><a href="/x">l</a></p></div>'
    const a = convert(html).state
    expect(validateLexical(a, BLOCKS)).toEqual([])
    expect(convert(html).state).toEqual(a)
    expect((a.root as N).children!.map((c) => c.type)).toEqual([
      'heading',
      'quote',
      'paragraph',
      'horizontalrule',
      'paragraph',
    ])
  })

  it('lists image sources in document order', () => {
    expect(
      imageSources(
        '<img src="a.jpg"><p><img data-src="b.jpg" src="lazy.gif"></p><img src="a.jpg">',
      ),
    ).toEqual(['a.jpg', 'b.jpg'])
  })
})

describe('links and uploads', () => {
  it('maps size variants to the original file key', () => {
    expect(
      originalUploadUrl(
        new URL('http://www.islammalayalam.net/wp-content/uploads/2020/01/x-300x200.jpg'),
      ),
    ).toBe('https://islammalayalam.net/wp-content/uploads/2020/01/x.jpg')
    expect(
      originalUploadUrl(new URL('https://islammalayalam.net/wp-content/uploads/y-scaled.jpg')),
    ).toBe('https://islammalayalam.net/wp-content/uploads/y.jpg')
  })

  it('handles WordPress query links, uploads and unsafe schemes', () => {
    expect(rewriteHref('/?page_id=7', { pagePath: () => '/kb/a/' })).toEqual({
      keep: true,
      url: '/kb/a/',
      external: false,
    })
    expect(rewriteHref('https://islammalayalam.net/wp-content/uploads/a.pdf')).toEqual({
      keep: false,
      reason: 'unmapped',
    })
    expect(
      rewriteHref('https://islammalayalam.net/wp-content/uploads/a.pdf', {
        uploadUrl: () => '/api/media/file/a.pdf',
      }),
    ).toMatchObject({ keep: true, url: '/api/media/file/a.pdf' })
    expect(rewriteHref('https://islammalayalam.net/ഖുർആൻ')).toMatchObject({ url: '/ഖുർആൻ/' })
    for (const redirect of [
      'https://bit.ly/3abc',
      'http://www.google.com/url?q=https://attacker.invalid/&sa=D',
      'https://www.youtube.com/redirect?q=https://attacker.invalid',
      'https://l.facebook.com/l.php?u=https%3A%2F%2Fattacker.invalid%2F',
      'https://news.example/out?to=https://attacker.invalid/',
    ])
      expect(rewriteHref(redirect), redirect).toEqual({ keep: false, reason: 'redirect' })
    expect(rewriteHref('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ keep: true })
    expect(
      rewriteHref('https://islammalayalam.net/?redirect_to=https://attacker.invalid/'),
    ).toEqual({
      keep: true,
      url: '/',
      external: false,
    })
    // Only approved outside sites survive; the two spam hosts found in the real data are named here.
    for (const [href, reason] of [
      ['https://lawessaywritingservice.org/x', 'spam'],
      ['https://us.grademiners.com/', 'spam'],
      ['http://localhost/wp/test', 'not-approved'],
      ['https://unknown-site.example/page', 'not-approved'],
    ] as const)
      expect(rewriteHref(href), href).toEqual({ keep: false, reason })
    for (const ok of [
      'https://docs.google.com/forms/d/x/viewform',
      'http://m.facebook.com/islammalayalam.net/',
      'https://hajj.islamonlive.in/a',
    ])
      expect(rewriteHref(ok), ok).toMatchObject({ keep: true, external: true })
    expect(rewriteHref('http://m.facebook.com/x')).toMatchObject({
      url: 'https://m.facebook.com/x',
    })
    for (const sneaky of [
      'https://islammalayalam.net/%09/attacker.invalid/',
      'https://islammalayalam.net/%0a%5cattacker.invalid/',
    ])
      expect(rewriteHref(sneaky), sneaky).toEqual({ keep: false, reason: 'unmapped' })
    expect(rewriteHref('https://islammalayalam.net/more.php')).toEqual({
      keep: false,
      reason: 'unmapped',
    })
    expect(rewriteHref('https://best-essay-writers.com/x')).toEqual({ keep: false, reason: 'spam' })
    expect(rewriteHref('data:text/html,x')).toEqual({ keep: false, reason: 'unsafe' })
  })
})

describe('text helpers and exclusions', () => {
  it('decodes rendered titles and derives titles for untitled posts', () => {
    expect(htmlToText('ഖുര്&#x200d;ആന്&#x200d; &amp; <b>x</b>')).toBe('ഖുര്‍ആന്‍ & x')
    expect(deriveTitle('ഒന്നാമത്തെ വാക്യം ഇതാണ്. രണ്ടാമത്തെ വാക്യം.')).toBe(
      'ഒന്നാമത്തെ വാക്യം ഇതാണ്',
    )
    expect(deriveTitle('x'.repeat(200)).length).toBeLessThanOrEqual(90)
    expect(
      deriveTitle('Question: “ഭഗവത്ഗീത ദൈവികമാണോ?”Answer: നിലവിലുള്ള വേദങ്ങൾ മനുഷ്യ ഇടപെടലുകൾ'),
    ).toBe('ഭഗവത്ഗീത ദൈവികമാണോ?')
    expect(deriveTitle('Question: “ഭഗവത്ഗീത ദൈവികമാണോ?“Answer: …')).toBe('ഭഗവത്ഗീത ദൈവികമാണോ?')
    expect(deriveTitle('ചോദ്യം: വിവാഹമോചനം അനുവദനീയമാണോ? ഉത്തരം: അതെ')).toBe(
      'വിവാഹമോചനം അനുവദനീയമാണോ?',
    )
    expect(
      deriveTitle('നോമ്പു നോറ്റാൽ രണ്ടുണ്ട് കാര്യം: സി.രാധാകൃഷ്ണൻ ===== കുട്ടിക്കാലത്ത്'),
    ).toBe('നോമ്പു നോറ്റാൽ രണ്ടുണ്ട് കാര്യം: സി.രാധാകൃഷ്ണൻ')
    expect(summary('<p>short</p>', 'Body text that is long enough to use.')).toBe(
      'Body text that is long enough to use.',
    )
  })

  it('flags demo posts and tampered dates', () => {
    expect(isDemoPost({ categories: [258, 255] })).toBe(true)
    expect(isDemoPost({ categories: [258, 21] })).toBe(false)
    expect(isSuspectDate('2026-07-02T19:21:40')).toBe(true)
    expect(isSuspectDate('0020-02-08T15:23:45')).toBe(true)
    expect(isSuspectDate('2019-05-01T10:00:00')).toBe(false)
  })
})

describe('paths and dates', () => {
  it('builds hierarchical page paths and skips broken or cyclic chains', () => {
    const paths = pagePaths([
      { id: 1, slug: '%e0%b4%86%e0%b4%a6%e0%b5%bc%e0%b4%b6%e0%b4%82', parent: 0 },
      { id: 2, slug: 'child', parent: 1 },
      { id: 3, slug: 'orphan', parent: 99 },
      { id: 4, slug: 'a', parent: 5 },
      { id: 5, slug: 'b', parent: 4 },
    ])
    expect(paths.get(1)).toBe('/ആദർശം/')
    expect(paths.get(2)).toBe('/ആദർശം/child/')
    expect(paths.has(3)).toBe(false)
    expect(paths.has(4)).toBe(false)
  })

  it('repairs tampered dates from the nearest sane neighbour, in UTC', () => {
    const all = [
      { id: 10, date_gmt: '2020-01-01T08:00:00' },
      { id: 11, date_gmt: '2026-07-02T19:21:40' },
      { id: 12, date_gmt: '2020-03-01T08:00:00' },
    ]
    expect(repairedDate({ id: 11 }, all)).toBe('2020-01-01T08:00:00.000Z')
    expect(repairedDate({ id: 9 }, all)).toBe('2020-01-01T08:00:00.000Z') // none earlier → next one
    expect(toIso('2020-02-08T15:23:45')).toBe('2020-02-08T15:23:45.000Z')
    expect(toIso('not a date')).toBe(new Date(0).toISOString())
  })

  it('media needs: own uploads only, none for demo posts', () => {
    const post = {
      id: 1,
      categories: [21],
      content:
        '<img src="https://islammalayalam.net/wp-content/uploads/2020/01/a-300x200.jpg"><a href="http://www.islammalayalam.net/wp-content/uploads/b.pdf">b</a><a href="https://example.org/x.pdf">x</a>',
    } as Parameters<typeof mediaNeeds>[0]
    expect(mediaNeeds(post)).toHaveLength(2)
    expect(mediaNeeds({ ...post, categories: [258] })).toEqual([])
  })
})

describe('featured image fallback', () => {
  it('uses the first picture from the post text, never a PDF', () => {
    const resolved = new Map([
      ['2022/04/guide.pdf', { id: 'pdf1', url: '/f/guide.pdf', kind: 'application/pdf' }],
      ['2022/04/a.jpg', { id: 'img1', url: '/f/a.webp', kind: 'image/webp' }],
      ['2022/04/b.jpg', { id: 'img2', url: '/f/b.webp', kind: 'image/webp' }],
    ])
    expect(firstContentImage(resolved)).toBe('img1')
    expect(firstContentImage(new Map([...resolved].slice(0, 1)))).toBeUndefined()
    expect(firstContentImage(new Map())).toBeUndefined()
  })
})
