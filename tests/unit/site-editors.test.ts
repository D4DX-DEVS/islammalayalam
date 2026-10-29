import type { Field, GlobalConfig } from 'payload'
import { describe, expect, it } from 'vitest'
import { mainColumnBlocks, sidebarBlocks } from '@/payload/blocks/homepage'
import { SECTION_GROUPS, SECTION_NAMES, sectionLabel } from '@/payload/blocks/sectionNames'
import { Footer, Header, SiteSettings } from '@/payload/globals'

/** Names of the fields that are saved at the top level (unnamed tabs and rows only lay them out). */
const savedNames = (fields: Field[]): string[] =>
  fields.flatMap((f): string[] => {
    if (f.type === 'tabs')
      return f.tabs.flatMap((t) => ('name' in t && t.name ? [t.name] : savedNames(t.fields)))
    if (f.type === 'row' || f.type === 'collapsible') return savedNames(f.fields)
    return 'name' in f && f.type !== 'ui' ? [f.name] : []
  })

const allBlocks = [...new Set([...mainColumnBlocks, ...sidebarBlocks])]

describe('homepage section headers', () => {
  it('names a row after the heading visitors see', () => {
    expect(sectionLabel({ blockType: 'categoryGrid', title: 'ചോദ്യോത്തരം' })).toEqual({
      name: 'ചോദ്യോത്തരം',
      type: 'Card grid',
    })
  })

  it('drops the " — kind" tail of imported row names, since the kind is shown beside it', () => {
    expect(
      sectionLabel({ blockType: 'categoryFeature', blockName: 'സമകാലികം — lead + list' }),
    ).toEqual({ name: 'സമകാലികം', type: 'Lead story + list' })
  })

  it('says which media a media shelf lists', () => {
    expect(sectionLabel({ blockType: 'mediaShelf', format: 'ebook', title: 'E-Books' })).toEqual({
      name: 'E-Books',
      type: 'E-books',
    })
    expect(sectionLabel({ blockType: 'mediaShelf', format: 'audio' })).toEqual({
      name: 'Audio',
      type: null,
    })
  })

  it('falls back to the kind of section, without repeating it', () => {
    expect(sectionLabel({ blockType: 'topAds' })).toEqual({ name: 'Top ads banner', type: null })
    expect(sectionLabel({ blockType: 'somethingNew' })).toEqual({ name: 'Section', type: null })
  })

  it('every section has a short name, a picker group and the one-line header', () => {
    const groups = new Set<unknown>(Object.values(SECTION_GROUPS))
    for (const block of allBlocks) {
      const singular = block.labels?.singular
      expect(singular, block.slug).toBe(SECTION_NAMES[block.slug])
      expect(String(singular).length, block.slug).toBeLessThanOrEqual(24)
      expect(groups.has(block.admin?.group), `${block.slug} group`).toBe(true)
      expect(block.admin?.components?.Label, block.slug).toBe(
        '/payload/admin/homepage/SectionLabel#SectionLabel',
      )
    }
  })
})

describe('site forms split into tabs keep the saved data the same', () => {
  const names = (g: GlobalConfig) => savedNames(g.fields).sort()

  it('Site settings', () => {
    expect(names(SiteSettings)).toEqual(
      [
        'siteName',
        'siteNameMl',
        'tagline',
        'logo',
        'partnerLogo',
        'partnerUrl',
        'defaultOgImage',
        'contact',
        'social',
      ].sort(),
    )
  })

  it('Header and menu', () => {
    expect(names(Header)).toEqual(['mainMenu', 'showSocialInTopBar', 'topBarLinks'])
  })

  it('Footer', () => {
    expect(names(Footer)).toEqual(['bottomLinks', 'columns', 'copyright'])
  })

  it('menu and footer rows are named after their link text', () => {
    const rowLabel = (g: GlobalConfig, name: string) => {
      const find = (fields: Field[]): Field | undefined =>
        fields
          .flatMap((f) =>
            f.type === 'tabs' ? f.tabs.flatMap((t) => t.fields) : f.type === 'row' ? f.fields : [f],
          )
          .find((f) => 'name' in f && f.name === name)
      const field = find(g.fields)
      return field?.type === 'array' ? field.admin?.components?.RowLabel : undefined
    }
    const label = '/payload/admin/site/LinkRowLabel#LinkRowLabel'
    expect(rowLabel(Header, 'mainMenu')).toBe(label)
    expect(rowLabel(Header, 'topBarLinks')).toBe(label)
    expect(rowLabel(Footer, 'columns')).toBe(label)
    expect(rowLabel(Footer, 'bottomLinks')).toBe(label)
  })
})
