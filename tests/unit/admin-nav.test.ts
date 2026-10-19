import { describe, expect, it } from 'vitest'
import { buildNavGroups, NAV_GROUP_LABELS, type NavEntity } from '@/payload/admin/nav/navModel'
import { Authors } from '@/payload/collections/Authors'
import { Categories } from '@/payload/collections/Categories'
import { Media } from '@/payload/collections/Media'
import { Audios, Videos } from '@/payload/collections/MediaLinks'
import { Pages } from '@/payload/collections/Pages'
import { Posts } from '@/payload/collections/Posts'
import { PostalRequests } from '@/payload/collections/PostalRequests'
import { Quotes } from '@/payload/collections/Quotes'
import {
  AuditLogs,
  ContactMessages,
  MigrationIssues,
  MigrationRuns,
  Redirects,
} from '@/payload/collections/system'
import { Users } from '@/payload/collections/Users'
import { globals } from '@/payload/globals'

const col = (slug: string, label = slug): NavEntity => ({ slug, kind: 'collection', label })
const glob = (slug: string, label = slug): NavEntity => ({ slug, kind: 'global', label })

const everything: NavEntity[] = [
  // Deliberately out of order: the sidebar's order must not depend on config order.
  col('users', 'Users'),
  col('media', 'Files and images'),
  col('migration-issues', 'Migration issues'),
  col('posts', 'Posts'),
  glob('security-settings', 'Two-step login'),
  col('contact-messages', 'Messages'),
  col('audios', 'Audio'),
  glob('site-settings', 'Site settings'),
  col('quotes', 'Insights'),
  col('pages', 'Pages'),
  col('postal-requests', 'Postal library'),
  glob('header', 'Header and menu'),
  col('categories', 'Categories'),
  col('authors', 'Authors'),
  col('videos', 'Videos'),
  glob('homepage', 'Homepage'),
  glob('footer', 'Footer'),
  col('redirects', 'Redirects'),
  col('audit-logs', 'Activity log'),
  col('migration-runs', 'Migration runs'),
  glob('ads-banners', 'Ads banners'),
]

const labelsOf = (groups: ReturnType<typeof buildNavGroups>, key: string) =>
  groups.find((g) => g.key === key)?.items.map((i) => i.label)

describe('buildNavGroups', () => {
  it('groups by job, in a fixed order, with Migration tools last', () => {
    const groups = buildNavGroups({ entities: everything })
    expect(groups.map((g) => g.label)).toEqual([
      'Write',
      'Library',
      'Inbox',
      'Site',
      'Team',
      'Migration tools',
    ])
    expect(labelsOf(groups, 'write')).toEqual(['Posts', 'Pages', 'Categories', 'Authors'])
    expect(labelsOf(groups, 'library')).toEqual(['Audio', 'Videos', 'Insights', 'Files and images'])
    expect(labelsOf(groups, 'inbox')).toEqual(['Messages', 'Postal library'])
    expect(labelsOf(groups, 'site')).toEqual([
      'Website manager',
      'Homepage',
      'Header and menu',
      'Footer',
      'Site settings',
      'Ads banners',
    ])
    expect(labelsOf(groups, 'team')).toEqual([
      'Users',
      'Redirects',
      'Activity log',
      'Two-step login',
    ])
    expect(groups.at(-1)?.tucked).toBe(true)
    expect(labelsOf(groups, 'migration')).toEqual(['Migration runs', 'Migration issues'])
  })

  it('points each item at its admin path', () => {
    const items = buildNavGroups({ entities: everything }).flatMap((g) => g.items)
    const href = (key: string) => items.find((i) => i.key === key)?.href
    expect(href('collection:posts')).toBe('/collections/posts')
    expect(href('collection:quotes')).toBe('/collections/quotes')
    expect(href('global:header')).toBe('/globals/header')
    expect(href('view:website')).toBe('/website')
  })

  it('shows only what the role may open, and drops a group that ends up empty', () => {
    const author: NavEntity[] = [col('posts', 'Posts'), col('media', 'Files and images')]
    const groups = buildNavGroups({ entities: author })
    expect(groups.map((g) => g.key)).toEqual(['write', 'library', 'site'])
    expect(labelsOf(groups, 'site')).toEqual(['Website manager'])
    expect(groups.some((g) => g.tucked)).toBe(false)
  })

  it('hides the Website manager when asked to', () => {
    const groups = buildNavGroups({ entities: [col('posts')], websiteManager: false })
    expect(groups.map((g) => g.key)).toEqual(['write'])
  })

  it('puts the count on Inbox rows only when something is waiting', () => {
    const groups = buildNavGroups({
      entities: everything,
      badges: { 'contact-messages': 3, 'postal-requests': 0, posts: 9 },
    })
    const inbox = groups.find((g) => g.key === 'inbox')!.items
    expect(inbox.find((i) => i.slug === 'contact-messages')?.badge).toBe(3)
    expect(inbox.find((i) => i.slug === 'postal-requests')?.badge).toBeUndefined()
    // A badge is only for the collections that ask for one (the layout never forwards others by accident).
    expect(groups.find((g) => g.key === 'write')!.items[0]?.badge).toBe(9)
  })

  it('keeps an entity the layout does not know about, under More, before Migration tools', () => {
    const groups = buildNavGroups({ entities: [...everything, col('newsletters', 'Newsletters')] })
    expect(groups.at(-2)?.label).toBe('More')
    expect(labelsOf(groups, 'more')).toEqual(['Newsletters'])
    expect(groups.at(-1)?.tucked).toBe(true)
  })
})

describe('admin names and groups', () => {
  const collections = [
    Posts,
    Pages,
    Categories,
    Authors,
    Audios,
    Videos,
    Quotes,
    Media,
    ContactMessages,
    PostalRequests,
    Users,
    Redirects,
    AuditLogs,
    MigrationRuns,
    MigrationIssues,
  ]
  const group = (slug: string) =>
    [...collections, ...globals].find((c) => c.slug === slug)?.admin?.group

  it('every collection and global sits in one of the six groups', () => {
    const allowed = new Set<unknown>(Object.values(NAV_GROUP_LABELS))
    for (const c of [...collections, ...globals]) {
      expect(allowed.has(c.admin?.group), `${c.slug} group`).toBe(true)
    }
  })

  it('the layout and the configs agree on which group each thing is in', () => {
    const groups = buildNavGroups({ entities: everything })
    const byGroupLabel = (key: string) => NAV_GROUP_LABELS[key as keyof typeof NAV_GROUP_LABELS]
    for (const g of groups) {
      for (const item of g.items) {
        if (item.kind === 'view') continue
        expect(group(item.slug), item.slug).toBe(byGroupLabel(g.key))
      }
    }
  })

  it('uses one name per thing: Insights, Audio, Files and images', () => {
    const plural = (slug: string) => {
      const c = collections.find((x) => x.slug === slug)
      const l = c?.labels?.plural
      return typeof l === 'string' ? l : undefined
    }
    expect(plural('quotes')).toBe('Insights')
    expect(plural('audios')).toBe('Audio')
    expect(plural('media')).toBe('Files and images')
    expect(plural('contact-messages')).toBe('Messages')
    expect(plural('postal-requests')).toBe('Postal library')
    expect(plural('audit-logs')).toBe('Activity log')
    const label = (slug: string) => globals.find((g) => g.slug === slug)?.label
    expect(label('header')).toBe('Header and menu')
    expect(label('security-settings')).toBe('Two-step login')
  })
})
