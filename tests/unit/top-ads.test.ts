import { describe, expect, it } from 'vitest'
import { placeTopAds } from '@/lib/top-ads'
import { moveBlock } from '@/payload/admin/website/reorder'
import { buildWebsite, type SitePermissions, type WebsiteInput } from '@/payload/admin/websiteModel'

const block = (blockType: string, id: string, extra: Record<string, unknown> = {}) => ({
  blockType,
  id,
  ...extra,
})

describe('placeTopAds', () => {
  const banner = block('topAds', 'ads')
  const others = [block('featuredSlider', 'h'), block('shorts', 's')]

  it('keeps the banner where the layout puts it and does not repeat it at the top', () => {
    const out = placeTopAds([others[0]!, banner, others[1]!], [], true)
    expect(out.layout.map((b) => b.id)).toEqual(['h', 'ads', 's'])
    expect(out.atTop).toBe(false)
  })

  it('leaves the banner at the very top, as before, when the layout has no such section', () => {
    const out = placeTopAds(others, [], true)
    expect(out.layout).toEqual(others)
    expect(out.atTop).toBe(true)
  })

  it('treats a hidden section as a choice: the banner is then not shown at all', () => {
    const out = placeTopAds([others[0]!, { ...banner, hidden: true }], [], true)
    expect(out.atTop).toBe(false)
  })

  it('looks in the sidebar too', () => {
    expect(placeTopAds(others, [banner], true).atTop).toBe(false)
  })

  it('drops the section, and shows nothing at the top, when there is no banner to draw', () => {
    const out = placeTopAds([others[0]!, banner, others[1]!], [], false)
    expect(out.layout.map((b) => b.id)).toEqual(['h', 's'])
    expect(out.atTop).toBe(false)
    expect(placeTopAds(others, [], false).atTop).toBe(false)
  })
})

describe('moveBlock', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('moves a block one place up or down', () => {
    expect(moveBlock(list, 'b', -1)?.map((b) => b.id)).toEqual(['b', 'a', 'c'])
    expect(moveBlock(list, 'b', 1)?.map((b) => b.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not change the list it was given', () => {
    moveBlock(list, 'b', -1)
    expect(list.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('says no when the block is not there or is already at that end', () => {
    expect(moveBlock(list, 'a', -1)).toBeNull()
    expect(moveBlock(list, 'c', 1)).toBeNull()
    expect(moveBlock(list, 'zzz', 1)).toBeNull()
    expect(moveBlock([], 'a', 1)).toBeNull()
  })
})

describe('the top ads banner in the website manager', () => {
  const everything: SitePermissions = {
    readCollection: () => true,
    createCollection: () => true,
    updateCollection: () => true,
    updateGlobal: () => true,
  }
  const layout = [
    block('featuredSlider', 'h', { source: 'featured', limit: 5 }),
    block('categoryFeature', 'a', { width: 'full', layout: 'split', limit: 5 }),
    block('topAds', 'ads'),
    block('shorts', 's', { title: 'Shorts', channel: '@Dialogue_Media', limit: 12 }),
    block('categoryGrid', 'g', { width: 'full', columns: '3', limit: 6 }),
  ]
  const input = (over: Partial<WebsiteInput> = {}): WebsiteInput => ({
    admin: '/admin',
    can: everything,
    homepage: { layout, sidebar: [] } as never,
    header: null,
    footer: null,
    settings: null,
    categories: [],
    counts: {},
    ads: { top: [{ image: 'm1' }, { image: 'm2', active: false }], bottom: [] } as never,
    aiSearchOn: false,
    ...over,
  })

  it('is a section of the homepage list, in the place the layout gives it (above Shorts)', () => {
    const keys = buildWebsite(input()).homepage.map((r) => r.key)
    expect(keys.indexOf('topAds-ads')).toBe(keys.indexOf('shorts-s') - 1)
  })

  it('describes the banners, says how to move it, and links to where the pictures are set', () => {
    const row = buildWebsite(input()).homepage.find((r) => r.key === 'topAds-ads')!
    expect(row).toMatchObject({
      label: 'Top ads banner',
      icon: 'banner',
      moreHref: '/admin/globals/ads-banners',
      moreLabel: 'Edit banners',
      editHref: '/admin/globals/homepage',
    })
    expect(row.detail).toMatch(/1 banner \(1 hidden\)/)
    expect(row.note).toMatch(/arrows/i)
  })

  it('offers "Add a banner" while there are none', () => {
    const row = buildWebsite(input({ ads: { top: [], bottom: [] } as never })).homepage.find(
      (r) => r.key === 'topAds-ads',
    )!
    expect(row.moreLabel).toBe('Add a banner')
    expect(row.detail).toMatch(/Nothing is shown here yet/)
  })

  it('is no longer listed again under "On every page" once it has its own section', () => {
    expect(buildWebsite(input()).site.some((r) => r.key === 'top-banner')).toBe(false)
    const without = buildWebsite(
      input({ homepage: { layout: layout.filter((b) => b.id !== 'ads'), sidebar: [] } as never }),
    )
    expect(without.site.some((r) => r.key === 'top-banner')).toBe(true)
  })

  it('gives every homepage section its place for the arrows, first and last included', () => {
    const rows = buildWebsite(input()).homepage.filter((r) => r.move)
    expect(rows.map((r) => r.move!.id)).toEqual(['h', 'a', 'ads', 's', 'g'])
    expect(rows[0]!.move).toEqual({ field: 'layout', id: 'h', first: true, last: false })
    expect(rows.at(-1)!.move).toMatchObject({ id: 'g', first: false, last: true })
    // The panels built from other content cannot be moved.
    const auto = buildWebsite(input()).homepage.filter((r) => r.auto)
    expect(auto.length).toBeGreaterThan(0)
    for (const row of auto) expect(row.move).toBeUndefined()
  })

  it('offers no arrows (and no edit links) to a role that may not edit the Homepage', () => {
    const none = buildWebsite(input({ can: { ...everything, updateGlobal: () => false } }))
    expect(none.homepage.some((r) => r.move)).toBe(false)
    expect(none.homepage.find((r) => r.key === 'topAds-ads')).toMatchObject({
      editHref: null,
      moreHref: null,
    })
  })
})
