import { describe, expect, it } from 'vitest'
import { adLink, toAds } from '@/lib/ads'
import { validateAdLink } from '@/payload/fields'
import { AdsBanners } from '@/payload/globals'

const media = (over: Record<string, unknown> = {}) => ({
  id: 'm',
  url: 'https://cdn.test/media/ad.png',
  width: 1640,
  height: 300,
  alt: 'An ad',
  ...over,
})
const row = (over: Record<string, unknown> = {}) => ({ id: 'r1', image: media(), ...over }) as never

describe('adLink', () => {
  it('opens a web address in a new tab unless the editor chose the same window', () => {
    expect(adLink('https://example.com/a', 'new')).toEqual({
      href: 'https://example.com/a',
      external: true,
      newTab: true,
    })
    expect(adLink('https://example.com/a', 'same')).toMatchObject({ external: true, newTab: false })
    expect(adLink('https://example.com/a', undefined)).toMatchObject({ newTab: true })
  })

  it('accepts a page of this site', () => {
    expect(adLink('/about-us/', 'same')).toEqual({
      href: '/about-us/',
      external: false,
      newTab: false,
    })
    expect(adLink('  /about-us/  ', 'new')?.href).toBe('/about-us/')
  })

  it.each([
    '',
    '   ',
    'example.com',
    'javascript:alert(1)',
    'data:text/html,hi',
    'mailto:a@b.co',
    'tel:+911234567890',
    '//evil.example/x',
    '#top',
  ])('gives no link for %j', (url) => expect(adLink(url, 'new')).toBeNull())

  it('gives no link when nothing is set', () => {
    expect(adLink(null, 'new')).toBeNull()
    expect(adLink(undefined, 'same')).toBeNull()
  })
})

describe('toAds', () => {
  it('turns stored banners into drawable ads, in order, with the original image and the link choice', () => {
    const ads = toAds([
      row({ id: 'a', url: 'https://one.test/', openIn: 'new' }),
      row({ id: 'b', url: '/page/', openIn: 'same', alt: '  Custom description ' }),
    ])
    expect(ads.map((a) => a.key)).toEqual(['a', 'b'])
    expect(ads[0]).toMatchObject({
      picture: { src: 'https://cdn.test/media/ad.png', width: 1640, height: 300, alt: 'An ad' },
      phone: null,
      link: { href: 'https://one.test/', external: true, newTab: true },
    })
    expect(ads[1]!.link).toEqual({ href: '/page/', external: false, newTab: false })
    expect(ads[1]!.picture.alt).toBe('Custom description')
  })

  it('leaves out hidden banners, and ones with no usable picture', () => {
    const ads = toAds([
      row({ id: 'shown' }),
      row({ id: 'off', active: false }),
      row({ id: 'string-id', image: 'abc123' }),
      row({ id: 'no-size', image: media({ width: null }) }),
      row({ id: 'no-url', image: media({ url: null }) }),
    ])
    expect(ads.map((a) => a.key)).toEqual(['shown'])
  })

  it('keeps an unclickable banner and drops an unsafe link instead of the banner', () => {
    const ads = toAds([row({ id: 'plain' }), row({ id: 'bad', url: 'javascript:alert(1)' })])
    expect(ads.map((a) => [a.key, a.link])).toEqual([
      ['plain', null],
      ['bad', null],
    ])
  })

  it('carries the phone picture when there is one', () => {
    const [ad] = toAds([
      row({ mobileImage: media({ url: 'https://cdn.test/m.png', width: 900, height: 360 }) }),
    ])
    expect(ad!.phone).toEqual({ src: 'https://cdn.test/m.png', width: 900, height: 360 })
  })

  it('is empty for no banners', () => {
    expect(toAds(null)).toEqual([])
    expect(toAds(undefined)).toEqual([])
    expect(toAds([])).toEqual([])
  })
})

describe('validateAdLink', () => {
  const check = (v: unknown) =>
    (validateAdLink as unknown as (v: unknown, o: unknown) => true | string)(v, {})
  it('allows empty, web addresses and site pages', () => {
    for (const ok of ['', null, undefined, 'https://a.co/x?y=1', 'http://a.co', '/about-us/']) {
      expect(check(ok)).toBe(true)
    }
  })
  it('explains what is accepted otherwise', () => {
    for (const bad of ['example.com', 'javascript:alert(1)', 'mailto:a@b.co', '//evil.example']) {
      expect(check(bad)).toMatch(/https:\/\//)
    }
  })
})

describe('the Ads banners global', () => {
  const tabs = (
    AdsBanners.fields[0] as {
      tabs: Array<{
        label: string
        fields: Array<{
          name: string
          fields: Array<{ name?: string; defaultValue?: unknown; options?: unknown }>
        }>
      }>
    }
  ).tabs
  const names = (tab: number) => tabs[tab]!.fields[0]!.fields.map((f) => f.name)

  it('has a top and a bottom list, each with add / delete rows', () => {
    expect(tabs.map((t) => t.label)).toEqual(['Top ads banner', 'Bottom ads banner'])
    expect(tabs[0]!.fields[0]!.name).toBe('top')
    expect(tabs[1]!.fields[0]!.name).toBe('bottom')
  })

  it('gives every banner an image, a URL, same-window / new-tab, and a switch', () => {
    for (const tab of [0, 1])
      for (const f of ['image', 'url', 'openIn', 'active']) expect(names(tab)).toContain(f)
    const openIn = tabs[0]!.fields[0]!.fields.find((f) => f.name === 'openIn')!
    expect(openIn.defaultValue).toBe('new')
    expect((openIn.options as Array<{ value: string }>).map((o) => o.value).sort()).toEqual([
      'new',
      'same',
    ])
  })

  it('offers a phone picture on the top banners only', () => {
    expect(names(0)).toContain('mobileImage')
    expect(names(1)).not.toContain('mobileImage')
  })

  it('is public to read and editable by editors, in the Website group', () => {
    expect(AdsBanners.slug).toBe('ads-banners')
    expect(AdsBanners.admin?.group).toBe('Website')
    expect((AdsBanners.access?.read as () => boolean)()).toBe(true)
  })
})
