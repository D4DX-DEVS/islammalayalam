import { describe, expect, it } from 'vitest'
import { classifyPages } from '../../migration/lib/exclusions'
import { fileLink } from '../../migration/load/content'
import { menuOrder } from '../../migration/load/pages'
import { plannedRedirects } from '../../migration/load/redirects'
import { htmlToLexical } from '../../migration/transform/lexical'
import { pageModel, parseShortcodes } from '../../migration/transform/shortcodes'
import { takeVideo } from '../../migration/transform/video'

// WordPress "texturized" the quotes of unregistered shortcodes: title=”…″ as HTML entities.
const q = (s: string) => `&#8221;${s}&#8243;`

describe('WPBakery shortcodes → page model', () => {
  it('turns tabs and accordions into titled sections and keeps the text before them as body', () => {
    const html =
      `[vc_row][vc_column width=${q('2/3')}][vc_column_text]<p>Intro text</p>[/vc_column_text]` +
      `[vc_tta_tabs style=${q('modern')}][vc_tta_section title=&#8221;ഖുര്&#x200d;ആന്&#x200d; സൂക്തങ്ങള്&#x200d;&#8221; tab_id=${q('1')}]` +
      `[vc_column_text]</p><h3>ആദർശം</h3><p>Verse</p>[/vc_column_text][/vc_tta_section]` +
      `[vc_tta_section title=${q('Hadith')}][vc_column_text]<p>Saying</p>[/vc_column_text][/vc_tta_section]` +
      `[/vc_tta_tabs][/vc_column][/vc_row]`
    const m = pageModel(html)
    expect(m.body).toContain('Intro text')
    expect(m.sections.map((s) => s.title)).toEqual(['ഖുര്‍ആന്‍ സൂക്തങ്ങള്‍', 'Hadith'])
    expect(m.sections[0]!.html).toContain('Verse')
    expect(`${m.body}${m.sections.map((s) => s.html).join('')}`).not.toMatch(/\[\/?vc_/)
    expect(m.warnings).toEqual([])
  })

  it('accordions, headings, YouTube video; menus dropped; raw HTML never trusted', () => {
    const m = pageModel(
      `[vc_headings title=${q('ദൈവം')}]<p>lead</p>[/vc_headings][vc_wp_custommenu nav_menu=${q('25')}]` +
        `[vc_video link=${q('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}][vc_video]` +
        `[vc_raw_html]JTNDc2NyaXB0JTNF[/vc_raw_html]` +
        `[accordion_father][accordion_son title=${q('Q')}]<p>A</p>[/accordion_son][/accordion_father]`,
    )
    expect(m.body).toContain('<h2>ദൈവം</h2>')
    expect(m.body).toContain('youtube.com/embed/dQw4w9WgXcQ')
    expect(m.body).not.toContain('JTNDc2NyaXB0JTNF')
    expect(m.sections).toEqual([{ title: 'Q', html: '<p>A</p>' }])
    expect(m.warnings).toEqual([
      'video element without a YouTube link removed',
      'raw HTML block removed (never trusted)',
    ])
  })

  it('leaves ordinary bracketed text alone and survives unbalanced tags', () => {
    expect(parseShortcodes('[2:255] and [note]').children).toEqual(['[2:255] and [note]'])
    const m = pageModel('[vc_row][vc_column_text]<p>open</p>[/vc_row][/vc_column_text][/nope]')
    expect(m.body).toContain('open')
    expect(m.sections).toEqual([])
  })
})

describe('video of a video post', () => {
  const root = (html: string) =>
    htmlToLexical(html, { seed: 't', image: () => null }).state.root as unknown as {
      children: Array<Record<string, unknown>>
    }

  it('takes the embed first and removes it from the body', () => {
    const r = root(
      '<p>Talk</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><p>more</p>',
    )
    expect(takeVideo(r)).toContain('dQw4w9WgXcQ')
    expect(r.children.some((n) => n.type === 'block')).toBe(false)
  })

  it('takes a pasted link or bare URL; removes the paragraph only when nothing else is in it', () => {
    const bare = root('<p>https://youtu.be/dQw4w9WgXcQ</p><p>Description</p>')
    expect(takeVideo(bare)).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(bare.children).toHaveLength(1)
    const linked = root(
      '<p>Watch: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=20s">here</a> today</p>',
    )
    expect(takeVideo(linked)).toContain('v=dQw4w9WgXcQ')
    expect(linked.children).toHaveLength(1) // other words → kept
    expect(takeVideo(root('<p>No video here</p>'))).toBeNull()
    const described = root('<p>Episode 54 | Prakasharekha https://youtu.be/dQw4w9WgXcQ</p>')
    expect(takeVideo(described)).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(JSON.stringify(described)).not.toContain('youtu.be')
    expect(JSON.stringify(described)).toContain('Episode 54 | Prakasharekha')
    const autoLinked = root(
      '<p>Episode 55 <a href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a></p>',
    )
    expect(takeVideo(autoLinked)).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(JSON.stringify(autoLinked)).not.toContain('youtu.be')
    expect(JSON.stringify(autoLinked)).toContain('Episode 55')
  })
})

describe('links to stored files', () => {
  it('app-served files become site paths; CDN files keep https; nothing else is linked', () => {
    expect(fileLink('http://localhost:3000/api/media/file/book.pdf')).toBe(
      '/api/media/file/book.pdf',
    )
    expect(fileLink('/api/media/file/book.pdf')).toBe('/api/media/file/book.pdf')
    expect(fileLink('https://bucket.blr1.cdn.digitaloceanspaces.com/media/book.pdf')).toBe(
      'https://bucket.blr1.cdn.digitaloceanspaces.com/media/book.pdf',
    )
    expect(fileLink('http://cdn.example/media/book.pdf')).toBeNull()
    expect(fileLink(undefined)).toBeNull()
  })
})

describe('pages and redirects', () => {
  const pages = [
    { id: 269, parent: 0, slug: 'ആദര്‍ശം' },
    { id: 300, parent: 269, slug: 'child' },
    { id: 220, parent: 0, slug: 'about' },
    { id: 207, parent: 0, slug: 'typography' },
    { id: 999, parent: 12345, slug: 'orphan' },
  ]

  it('classifies knowledge-base, static and demo pages', () => {
    const kinds = classifyPages(pages)
    expect(Object.fromEntries(kinds)).toEqual({
      269: 'kb',
      300: 'kb',
      220: 'static',
      207: 'demo',
      999: 'demo',
    })
  })

  it('410 for demo pages, posts and categories; slider → home; canonical paths', () => {
    const rows = plannedRedirects({
      posts: [
        { id: 5, categories: [258] },
        { id: 6, categories: [21] },
      ],
      categories: [
        { id: 89, slug: 'slider' },
        { id: 258, slug: 'travel' },
        { id: 21, slug: 'news' },
      ],
      kinds: classifyPages(pages),
      allPagePaths: new Map([
        [207, '/typography/'],
        [269, '/ആദർശം/'],
      ]),
    })
    expect(rows).toEqual([
      { from: '/typography/', code: '410' },
      { from: '/5/', code: '410' },
      { from: '/category/slider/', code: '301', to: '/' },
      { from: '/category/travel/', code: '410' },
    ])
  })

  it('menu order follows the original menu, by canonical path', () => {
    const order = menuOrder([
      { href: '/' },
      { href: '/ആദര്‍ശം/', children: [{ href: '/ആദര്‍ശം/child/' }] },
    ])
    expect(order.get('/ആദർശം/')).toBe(1)
    expect(order.get('/ആദർശം/child/')).toBe(2)
  })
})
