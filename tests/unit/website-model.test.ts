import { describe, expect, it } from 'vitest'
import { buildWebsite, type SitePermissions, type WebsiteInput } from '@/payload/admin/websiteModel'
import { audioSource } from '@/lib/audio'
import { categoryIcon } from '@/lib/category-icons'
import { CATEGORY_ICON_OPTIONS } from '@/lib/category-icon-names'

const everything: SitePermissions = {
  readCollection: () => true,
  createCollection: () => true,
  updateCollection: () => true,
  updateGlobal: () => true,
}
const nothing: SitePermissions = {
  readCollection: () => false,
  createCollection: () => false,
  updateCollection: () => false,
  updateGlobal: () => false,
}

const cat = (name: string, extra: Record<string, unknown> = {}) =>
  ({ id: name, name, slug: name.toLowerCase(), ...extra }) as never

/** The live homepage layout (hero, lead + list, grid, video band, stacked lead, audio + e-books). */
const layout = [
  {
    id: 'h',
    blockType: 'featuredSlider',
    source: 'featured',
    limit: 5,
    sideTitle: 'പുതിയ വാർത്തകൾ',
  },
  {
    id: 'a',
    blockType: 'categoryFeature',
    width: 'full',
    layout: 'split',
    limit: 5,
    category: cat('News'),
  },
  {
    id: 'b',
    blockType: 'categoryGrid',
    width: 'full',
    columns: '3',
    limit: 6,
    category: cat('Qa'),
  },
  {
    id: 'c',
    blockType: 'mediaShelf',
    width: 'full',
    format: 'video',
    limit: 4,
    category: cat('Videos'),
  },
  {
    id: 'd',
    blockType: 'categoryFeature',
    width: 'full',
    layout: 'stacked',
    limit: 5,
    category: cat('Articles'),
  },
  {
    id: 'e',
    blockType: 'mediaShelf',
    width: 'half',
    format: 'audio',
    limit: 3,
    category: cat('Audios'),
  },
  {
    id: 'f',
    blockType: 'mediaShelf',
    width: 'half',
    format: 'ebook',
    limit: 3,
    category: cat('Books'),
  },
]

const input = (over: Partial<WebsiteInput> = {}): WebsiteInput => ({
  admin: '/admin',
  can: everything,
  homepage: { layout, sidebar: [] } as never,
  header: { mainMenu: [{}, {}], topBarLinks: [{}] } as never,
  footer: { columns: [{}, {}, {}], bottomLinks: [] } as never,
  settings: { siteName: 'Islam Malayalam', tagline: 'T' } as never,
  categories: [
    cat('News'),
    cat('Qa'),
    cat('Hidden', { hidden: true }),
    cat('Off', { showInStrip: false }),
  ],
  counts: {
    articles: 10,
    videos: 4,
    audios: 4,
    ebooks: 3,
    pages: 20,
    authors: 2,
    media: 99,
    redirects: 5,
  },
  ...over,
  aiSearchOn: over.aiSearchOn ?? false,
})

describe('website manager model', () => {
  it('lists the homepage in page order, with the automatic panels where visitors see them', () => {
    const keys = buildWebsite(input()).homepage.map((r) => r.key)
    expect(keys).toEqual([
      'featuredSlider-h',
      'category-strip', // right under the hero
      'categoryFeature-a',
      'auto-topics', // beside the first lead + list, until the editor adds their own
      'categoryGrid-b',
      'mediaShelf-c',
      'categoryFeature-d',
      'mediaShelf-e',
      'mediaShelf-f',
    ])
  })

  it('does not invent a topics panel once the editor placed one', () => {
    const withTopics = [
      ...layout.slice(0, 2),
      { id: 't', blockType: 'topicGrid', limit: 4 },
      ...layout.slice(2),
    ]
    const keys = buildWebsite(input({ homepage: { layout: withTopics } as never })).homepage.map(
      (r) => r.key,
    )
    expect(keys).toContain('topicGrid-t')
    expect(keys).not.toContain('auto-topics')
  })

  it('names the audio shelf as the player and counts visible strip categories only', () => {
    const data = buildWebsite(input())
    expect(data.homepage.find((r) => r.key === 'mediaShelf-e')).toMatchObject({
      label: 'Audios',
      icon: 'audio',
    })
    expect(data.homepage.find((r) => r.key === 'category-strip')?.detail).toContain(
      '2 round icon tiles',
    )
  })

  it('marks hidden sections', () => {
    const hidden = layout.map((b) => (b.id === 'b' ? { ...b, hidden: true } : b))
    const data = buildWebsite(input({ homepage: { layout: hidden } as never }))
    expect(data.homepage.find((r) => r.key === 'categoryGrid-b')?.hidden).toBe(true)
    expect(data.homepage.find((r) => r.key === 'categoryGrid-a')).toBeUndefined()
  })

  it('offers Edit links and counts only where the role may', () => {
    const open = buildWebsite(input())
    expect(open.homepage[0]!.editHref).toBe('/admin/globals/homepage')
    expect(open.site.map((r) => r.editHref)).toEqual([
      '/admin/globals/header',
      '/admin/globals/site-settings',
      '/admin/globals/footer',
      '/admin/globals/site-settings', // WhatsApp number lives in Site settings
      null, // AI search is a server setting, not edited in the admin
    ])
    expect(open.content.find((c) => c.key === 'audios')).toMatchObject({
      count: 4,
      listHref: '/admin/collections/posts?where[format][equals]=audio',
      createHref: '/admin/collections/posts/create',
    })

    const locked = buildWebsite(input({ can: nothing }))
    expect(locked.homepage.every((r) => r.editHref === null)).toBe(true)
    expect(locked.site.every((r) => r.editHref === null)).toBe(true)
    expect(locked.content.every((c) => c.count === null && c.createHref === null)).toBe(true)
  })

  it('shows whether the WhatsApp button and AI search are on, and how to turn them on', () => {
    const off = buildWebsite(input()).site
    expect(off.find((r) => r.key === 'whatsapp')).toMatchObject({ editLabel: 'Add a number' })
    expect(off.find((r) => r.key === 'ai-search')?.note).toMatch(/ANTHROPIC_API_KEY/)

    const on = buildWebsite(
      input({
        aiSearchOn: true,
        settings: { siteName: 'S', contact: { whatsappNumber: '+91 98765 43210' } } as never,
      }),
    ).site
    expect(on.find((r) => r.key === 'whatsapp')).toMatchObject({ editLabel: 'Edit number' })
    expect(on.find((r) => r.key === 'ai-search')?.note).toBeUndefined()
  })

  it('copes with an empty homepage', () => {
    const data = buildWebsite(input({ homepage: null }))
    expect(data.homepageEmpty).toBe(true)
    expect(data.homepage.map((r) => r.key)).toEqual(['category-strip'])
  })
})

describe('audio source rules', () => {
  it('embeds Spotify, plays site/CDN files inline, and links out everything else', () => {
    expect(audioSource('https://open.spotify.com/episode/0Q86acNRm6V9GYx55SXKwf')).toMatchObject({
      kind: 'spotify',
      src: 'https://open.spotify.com/embed/episode/0Q86acNRm6V9GYx55SXKwf',
      tall: false,
    })
    expect(audioSource('https://open.spotify.com/show/0Q86acNRm6V9GYx55SXKwf')).toMatchObject({
      kind: 'spotify',
      tall: true,
    })
    expect(audioSource('/api/media/file/talk.mp3')).toEqual({
      kind: 'file',
      src: '/api/media/file/talk.mp3',
    })
    expect(audioSource('https://elsewhere.example/talk.mp3')).toEqual({
      kind: 'link',
      src: 'https://elsewhere.example/talk.mp3',
    })
    expect(audioSource('')).toEqual({ kind: 'none' })
    expect(audioSource(undefined)).toEqual({ kind: 'none' })
  })
})

describe('category icons', () => {
  it('uses the editor-picked icon first, then matches the name, then a stable fallback', () => {
    const picked = categoryIcon({ name: 'ചോദ്യോത്തരം', icon: 'heart' })
    const byName = categoryIcon({ name: 'ചോദ്യോത്തരം' })
    expect(picked).not.toBe(byName)
    expect(categoryIcon({ name: 'Something new' })).toBe(categoryIcon({ name: 'Something new' }))
  })

  it('has a drawing for every option the admin offers', () => {
    for (const { value } of CATEGORY_ICON_OPTIONS)
      expect(categoryIcon({ name: 'x', icon: value })).toBeDefined()
  })
})
