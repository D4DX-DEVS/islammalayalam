import type { Where } from 'payload'
import { transformWhereQuery, validateWhereQuery } from 'payload/shared'
import { describe, expect, it } from 'vitest'
import {
  activeTab,
  buildWhere,
  parseWhere,
  pickedValues,
  replaceOps,
  replacePath,
  selectTab,
  viewTabs,
  whereParams,
  type Leaf,
} from '@/payload/admin/lists/listQuery'
import {
  columnItems,
  filterDefs,
  humanize,
  isDefaultLayout,
  quickFilters,
} from '@/payload/admin/lists/listFields'
import {
  DATE_PRESETS,
  booleanLeaves,
  dateLeaves,
  dayKey,
  describeDateRange,
  describeFilter,
  fromDayKey,
  matchPreset,
  readDateRange,
} from '@/payload/admin/lists/listDescribe'
import { Posts } from '@/payload/collections/Posts'

const leaf = (path: string, op: string, value: unknown): Leaf => ({ path, op, value })

describe('list filter ⇄ where', () => {
  it('reads plain, AND-group and builder-shaped filters as one list of conditions', () => {
    expect(parseWhere(undefined)).toEqual({ leaves: [], advanced: false })
    expect(parseWhere({ _status: { equals: 'draft' } }).leaves).toEqual([
      leaf('_status', 'equals', 'draft'),
    ])
    const builder: Where = {
      or: [{ and: [{ format: { in: ['video'] } }, { publishedAt: { greater_than_equal: 'x', less_than_equal: 'y' } }] }],
    }
    expect(parseWhere(builder)).toEqual({
      advanced: false,
      leaves: [
        leaf('format', 'in', ['video']),
        leaf('publishedAt', 'greater_than_equal', 'x'),
        leaf('publishedAt', 'less_than_equal', 'y'),
      ],
    })
  })

  it('flags real OR groups as advanced instead of flattening them wrongly', () => {
    const where = { or: [{ and: [{ a: { equals: 1 } }] }, { and: [{ b: { equals: 2 } }] }] }
    expect(parseWhere(where)).toEqual({ leaves: [], advanced: true })
  })

  it('writes a flat AND back (which does not pop Payload’s builder open), and nothing for none', () => {
    expect(buildWhere([])).toEqual({})
    const leaves = [leaf('format', 'in', ['video']), leaf('featured', 'equals', true)]
    const where = buildWhere(leaves)
    expect(where).toEqual({ and: [{ format: { in: ['video'] } }, { featured: { equals: true } }] })
    expect(validateWhereQuery(where)).toBe(false)
    expect(parseWhere(where).leaves).toEqual(leaves)
    // Payload's builder still shows the same rows.
    expect(transformWhereQuery(where)).toEqual({ or: [{ and: where.and }] })
  })

  it('an editor replaces only its own operators on a field', () => {
    const leaves = [leaf('format', 'not_in', ['ebook']), leaf('format', 'in', ['video']), leaf('a', 'equals', 1)]
    expect(replaceOps(leaves, 'format', ['in', 'equals'], [leaf('format', 'in', ['audio'])])).toEqual([
      leaf('format', 'not_in', ['ebook']),
      leaf('format', 'in', ['audio']),
      leaf('a', 'equals', 1),
    ])
  })

  it('replaces only the conditions on the given field, in place', () => {
    const leaves = [leaf('a', 'equals', 1), leaf('b', 'equals', 2), leaf('c', 'equals', 3)]
    expect(replacePath(leaves, 'b', [leaf('b', 'in', [5])])).toEqual([
      leaf('a', 'equals', 1),
      leaf('b', 'in', [5]),
      leaf('c', 'equals', 3),
    ])
    expect(replacePath(leaves, 'b', [])).toEqual([leaf('a', 'equals', 1), leaf('c', 'equals', 3)])
    expect(replacePath(leaves, 'z', [leaf('z', 'equals', 0)]).at(-1)).toEqual(leaf('z', 'equals', 0))
  })

  it('reads picked values from arrays, URL comma lists and equals', () => {
    expect(pickedValues([leaf('x', 'in', ['a', 'b'])])).toEqual(['a', 'b'])
    expect(pickedValues([leaf('x', 'in', 'a,b')])).toEqual(['a', 'b'])
    expect(pickedValues([leaf('x', 'equals', 7)])).toEqual(['7'])
    // Over 20 items the URL parser returns an object keyed by position.
    expect(pickedValues([leaf('x', 'in', { 0: 'a', 21: 'b' })])).toEqual(['a', 'b'])
  })

  it('serializes a filter as where[…] REST parameters', () => {
    const params = whereParams(buildWhere([leaf('format', 'in', ['video', 'audio'])]))
    expect(params.get('where[and][0][format][in][1]')).toBe('audio')
  })
})

describe('status tabs', () => {
  const tabs = viewTabs(new Set(['_status', 'flags.needsReview']))

  it('offers All, Published, Drafts and Needs review only when the fields exist', () => {
    expect(tabs.map((t) => t.label)).toEqual(['All', 'Published', 'Drafts', 'Needs review'])
    expect(viewTabs(new Set(['_status'])).map((t) => t.key)).toEqual(['all', 'published', 'draft'])
    expect(viewTabs(new Set(['title']))).toEqual([])
  })

  it('knows the current tab, also when the URL turned true into "true"', () => {
    expect(activeTab(tabs, [])).toBe('all')
    expect(activeTab(tabs, [leaf('flags.needsReview', 'equals', 'true')])).toBe('review')
    expect(activeTab(tabs, [leaf('_status', 'equals', 'draft'), leaf('format', 'in', ['video'])])).toBe('draft')
    expect(activeTab(tabs, [leaf('_status', 'equals', 'draft'), leaf('flags.needsReview', 'equals', true)])).toBe(null)
  })

  it('switching tabs keeps every other filter', () => {
    const start = [leaf('format', 'in', ['video']), leaf('_status', 'equals', 'draft')]
    expect(selectTab(tabs, start, 'review')).toEqual([
      leaf('format', 'in', ['video']),
      leaf('flags.needsReview', 'equals', true),
    ])
    expect(selectTab(tabs, start, 'all')).toEqual([leaf('format', 'in', ['video'])])
  })
})

describe('filterable fields', () => {
  const defs = filterDefs(Posts.fields)
  const byPath = Object.fromEntries(defs.map((d) => [d.path, d]))

  it('finds choices, links, yes/no and dates, also inside tabs and groups', () => {
    expect(byPath.format).toMatchObject({ kind: 'options', label: 'This post is' })
    expect(byPath.format!.options!.map((o) => o.value)).toEqual(['standard', 'video', 'audio', 'ebook'])
    expect(byPath.categories).toMatchObject({ kind: 'relation', relationTo: 'categories' })
    expect(byPath.featured).toMatchObject({ kind: 'boolean' })
    expect(byPath.publishedAt).toMatchObject({ kind: 'date', label: 'Published at' })
    expect(byPath.featuredImage).toMatchObject({ kind: 'presence' })
    expect(byPath['flags.needsReview']).toMatchObject({ kind: 'boolean', group: 'Flags' })
    expect(byPath['video.url']).toMatchObject({ kind: 'text', group: 'Video' })
  })

  it('leaves out internal search fields, rich text and the WordPress plumbing', () => {
    expect(byPath.searchText).toBeUndefined()
    expect(byPath.content).toBeUndefined()
    expect(byPath['legacy.sourceHash']).toBeUndefined()
    expect(byPath['legacy.migratedAt']).toBeUndefined()
  })

  it('keeps fields that are only off the edit form, like Payload’s own createdAt', () => {
    // Payload adds these with admin.hidden; its own filter builder still offers them.
    const sanitized = [
      ...Posts.fields,
      { name: 'createdAt', type: 'date', admin: { hidden: true } },
      { name: 'computed', type: 'text', virtual: true },
      { name: 'gone', type: 'text', hidden: true },
    ]
    const paths = filterDefs(sanitized).map((d) => d.path)
    expect(paths).toContain('createdAt')
    expect(paths).not.toContain('computed')
    expect(paths).not.toContain('gone')
  })

  it('drops fields the signed-in user may not read, like Payload’s builder', () => {
    const fields = [
      { name: 'title', type: 'text' },
      { name: 'secret', type: 'text' },
      { name: 'flags', type: 'group', fields: [{ name: 'needsReview', type: 'checkbox' }, { name: 'note', type: 'text' }] },
    ]
    const perms = { title: { read: true }, secret: { read: false }, flags: { read: true, fields: { needsReview: true } } }
    expect(filterDefs(fields, perms).map((d) => d.path)).toEqual(['title', 'flags.needsReview'])
    expect(filterDefs(fields, true)).toHaveLength(4)
    expect(filterDefs(fields, undefined)).toHaveLength(4)
  })

  it('uses the collection’s own quick filters when set, else picks the most useful', () => {
    const configured = quickFilters(defs, ['categories', 'nope', 'featured'], [])
    expect(configured.map((d) => d.path)).toEqual(['categories', 'featured'])
    const auto = quickFilters(defs, undefined, ['_status', 'flags.needsReview'])
    expect(auto.map((d) => d.path)).toEqual(['format', 'categories', 'primaryCategory', 'author'])
  })

  it('humanizes field names', () => {
    expect(humanize('needsReview')).toBe('Needs review')
    expect(humanize('_status')).toBe('Status')
    expect(humanize('id')).toBe('ID')
  })
})

describe('column picker', () => {
  const field = (name: string, extra: Record<string, unknown> = {}) => ({ name, type: 'text', ...extra })
  const columns = [
    { accessor: 'title', active: true, field: field('title') },
    { accessor: 'video.url', active: false, field: field('url', { labelWithPrefix: 'Video > Url' }) },
    { accessor: 'meta.overview', active: false, field: { name: 'overview', type: 'ui' } },
    { accessor: 'rowActions', active: true, field: { name: 'rowActions', type: 'ui', label: 'Actions' } },
    { accessor: 'secret', active: false, field: field('secret', { admin: { disableListColumn: true } }) },
    { accessor: 'id', active: false, field: field('id', { hidden: true }) },
    { accessor: 'updatedAt', active: true, field: { name: 'updatedAt', type: 'date', admin: { hidden: true } } },
  ]

  it('groups nested fields, keeps the full-state index and drops empty display fields', () => {
    const items = columnItems(columns, ['title', 'rowActions'])
    expect(items.map((i) => [i.accessor, i.label, i.group, i.index])).toEqual([
      ['title', 'Title', null, 0],
      ['video.url', 'Url', 'Video', 1],
      ['rowActions', 'Actions', null, 3],
      ['id', 'ID', null, 5],
      // admin.hidden only keeps a field off the edit form: the column stays on offer.
      ['updatedAt', 'Updated at', null, 6],
    ])
  })

  it('knows when the layout is the default one', () => {
    const items = columnItems(columns, ['title', 'rowActions', 'updatedAt'])
    expect(isDefaultLayout(items, ['title', 'rowActions', 'updatedAt'])).toBe(true)
    expect(isDefaultLayout(items, ['rowActions', 'title', 'updatedAt'])).toBe(false)
  })
})

describe('chip text and editor conditions', () => {
  const now = new Date(2026, 9, 29, 15, 30)

  it('names date presets and custom ranges', () => {
    const preset = DATE_PRESETS.find((p) => p.key === '30d')!
    const last30 = readDateRange(dateLeaves('publishedAt', preset.range(now)))
    expect(last30.from && dayKey(last30.from)).toBe('2026-09-30')
    // Ends today: migrated posts with future dates stay out.
    expect(last30.to && dayKey(last30.to)).toBe('2026-10-29')
    expect(matchPreset(last30, now)?.key).toBe('30d')
    expect(describeDateRange(last30, now)).toBe('Last 30 days')
    // Open-ended "since" is not the preset.
    expect(matchPreset({ from: last30.from }, now)).toBeUndefined()
    expect(describeDateRange({ from: new Date(2026, 0, 5), to: new Date(2026, 1, 9) }, now)).toBe('5 Jan – 9 Feb')
    expect(describeDateRange({ to: new Date(2024, 4, 1) }, now)).toBe('Until 1 May 2024')
    expect(describeDateRange({}, now)).toBeNull()
  })

  it('reads date inputs as local days', () => {
    expect(fromDayKey('2026-02-09')?.getDate()).toBe(9)
    expect(fromDayKey('nope')).toBeUndefined()
  })

  it('describes choices with names, and relationship ids until titles load', () => {
    const def = { path: 'format', label: 'Format', kind: 'options' as const, options: [
      { label: 'A video', value: 'video' },
      { label: 'An audio', value: 'audio' },
      { label: 'An e-book', value: 'ebook' },
    ] }
    expect(describeFilter(def, [leaf('format', 'in', ['video', 'audio', 'ebook'])], now)).toBe('A video, An audio +1')
    const rel = { path: 'author', label: 'Author', kind: 'relation' as const, relationTo: 'authors' }
    expect(describeFilter(rel, [leaf('author', 'in', ['a1'])], now)).toBe('1 selected')
    expect(describeFilter(rel, [leaf('author', 'in', ['a1'])], now, { a1: 'Ali' })).toBe('Ali')
  })

  it('yes/no filters: "No" also matches items without a value', () => {
    expect(booleanLeaves('featured', false, 'boolean')).toEqual([leaf('featured', 'not_equals', true)])
    expect(booleanLeaves('featuredImage', false, 'presence')).toEqual([leaf('featuredImage', 'exists', false)])
    const def = { path: 'featured', label: 'Featured', kind: 'boolean' as const }
    expect(describeFilter(def, booleanLeaves('featured', false, 'boolean'), now)).toBe('No')
    expect(describeFilter(def, [leaf('featured', 'equals', 'true')], now)).toBe('Yes')
  })
})
