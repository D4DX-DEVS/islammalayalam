import { describe, expect, it } from 'vitest'
import { buildQueue, queueSummary } from '@/payload/admin/dashboard/queue'

const NOW = Date.parse('2026-10-17T06:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

const stats = { needsReview: 3, newRequests: 5, newMessages: 3, drafts: 6 }
const edges = {
  reviewOldest: daysAgo(2),
  requestNewest: hoursAgo(3),
  messageNewest: hoursAgo(26),
  draftOldest: daysAgo(12),
}
const base = {
  stats,
  edges,
  admin: '/admin',
  canRead: () => true,
  ownDraftsOnly: false,
  now: NOW,
}

describe('buildQueue', () => {
  it('lists review, postal requests, messages and drafts, in that order, with plain wording', () => {
    const rows = buildQueue(base)
    expect(rows.map((r) => r.key)).toEqual(['review', 'postal', 'messages', 'drafts'])
    expect(rows.map((r) => r.title)).toEqual([
      '3 posts flagged for review',
      '5 postal library requests',
      '3 new messages',
      '6 drafts in progress',
    ])
    expect(rows[0]?.detail).toBe('Oldest flagged 2 days ago')
    expect(rows[1]?.detail).toBe('Waiting to be handled · newest 3 hours ago')
    expect(rows[2]?.detail).toBe('From the contact form · newest yesterday')
    expect(rows[3]?.detail).toBe('Oldest edited last week')
    expect(rows.map((r) => r.action)).toEqual(['Review', 'Open', 'Open inbox', 'Continue'])
  })

  it('links each row to the filtered list under the admin route', () => {
    const rows = buildQueue(base)
    expect(rows.map((r) => r.href)).toEqual([
      '/admin/collections/posts?where[flags.needsReview][equals]=true',
      '/admin/collections/postal-requests?where[status][equals]=new',
      '/admin/collections/contact-messages?where[status][equals]=new',
      '/admin/collections/posts?where[_status][equals]=draft',
    ])
  })

  it('leaves out a row when nothing is waiting', () => {
    const rows = buildQueue({ ...base, stats: { ...stats, newRequests: 0, drafts: 0 } })
    expect(rows.map((r) => r.key)).toEqual(['review', 'messages'])
  })

  it('says singular for one', () => {
    const rows = buildQueue({
      ...base,
      stats: { needsReview: 1, newRequests: 1, newMessages: 1, drafts: 1 },
    })
    expect(rows.map((r) => r.title)).toEqual([
      '1 post flagged for review',
      '1 postal library request',
      '1 new message',
      '1 draft in progress',
    ])
  })

  it('never shows a row the role cannot read', () => {
    const rows = buildQueue({
      ...base,
      canRead: (slug) => slug === 'posts',
    })
    expect(rows.map((r) => r.key)).toEqual(['review', 'drafts'])
    expect(buildQueue({ ...base, canRead: () => false })).toEqual([])
  })

  it('still reads well when a date is missing', () => {
    const rows = buildQueue({
      ...base,
      edges: { reviewOldest: null, requestNewest: null, messageNewest: null, draftOldest: null },
    })
    expect(rows[0]?.detail).toBe('Flagged by an editor')
    expect(rows[1]?.detail).toBe('Waiting to be handled')
    expect(rows[2]?.detail).toBe('From the contact form')
    expect(rows[3]?.detail).toBe('Not live yet')
    const own = buildQueue({
      ...base,
      ownDraftsOnly: true,
      edges: { reviewOldest: null, requestNewest: null, messageNewest: null, draftOldest: null },
    })
    expect(own[3]?.detail).toBe('Your unfinished posts')
  })

  it('has no developer wording', () => {
    const text = buildQueue(base)
      .map((r) => `${r.title} ${r.detail} ${r.action}`)
      .join(' ')
    expect(text).not.toMatch(/api|server|\bkb\b|slug|collection/i)
  })
})

describe('queueSummary', () => {
  it('counts rows, not items', () => {
    expect(queueSummary(4)).toBe('4 things need you today')
    expect(queueSummary(1)).toBe('1 thing needs you today')
    expect(queueSummary(0)).toBe('Nothing needs you today')
  })
})
