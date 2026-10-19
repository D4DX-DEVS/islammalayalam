import { describe, expect, it } from 'vitest'
import { quoteDay, showableQuotes } from '@/features/quotes/pick'
import { istDayKey } from '@/lib/quote'

// 16 Oct 2026, 10:00 India time.
const NOW = new Date('2026-10-16T04:30:00Z')
const q = (id: string, over: { showOn?: string; createdAt?: string; _order?: string } = {}) => ({
  id,
  showOn: over.showOn ?? null,
  createdAt: over.createdAt ?? '2026-01-01T00:00:00Z',
  _order: over._order ?? null,
})
const ids = (quotes: Array<{ id: string }>) => quotes.map((x) => x.id)

describe('istDayKey', () => {
  it('uses the India calendar day', () => {
    expect(istDayKey('2026-10-15T19:00:00Z')).toBe('2026-10-16') // 00:30 IST
    expect(istDayKey('2026-10-15T18:29:00Z')).toBe('2026-10-15')
    expect(istDayKey(null)).toBeNull()
    expect(istDayKey('')).toBeNull()
    expect(istDayKey('nope')).toBeNull()
  })
})

describe('quoteDay', () => {
  it('counts from "Show on", else from the day it was created', () => {
    expect(quoteDay(q('a', { showOn: '2026-10-10T00:00:00Z' }))).toBe('2026-10-10')
    expect(quoteDay(q('b', { createdAt: '2026-03-05T10:00:00Z' }))).toBe('2026-03-05')
    expect(quoteDay({ id: 'c' })).toBeNull()
  })
})

describe('showableQuotes', () => {
  it('is empty when there are no quotes', () => {
    expect(showableQuotes([], NOW)).toEqual([])
  })

  it('follows the order set in the admin: the biggest position key is the top row', () => {
    const quotes = [
      q('third', { _order: 'a0' }),
      q('first', { _order: 'a2' }),
      q('second', { _order: 'a1' }),
    ]
    expect(ids(showableQuotes(quotes, NOW))).toEqual(['first', 'second', 'third'])
  })

  it('compares positions as plain text, like the database, including in-between keys', () => {
    const quotes = [
      q('a', { _order: 'a1' }),
      q('b', { _order: 'a1V' }),
      q('c', { _order: 'a2' }),
      q('d', { _order: 'Zz' }),
    ]
    // "Zz" < "a1" < "a1V" < "a2" in a plain (binary) comparison; a locale comparison would differ
    expect(ids(showableQuotes(quotes, NOW))).toEqual(['c', 'b', 'a', 'd'])
  })

  it('puts the ones not placed yet after the placed ones, newest first', () => {
    const quotes = [
      q('old-unplaced', { createdAt: '2026-03-01T00:00:00Z' }),
      q('placed', { _order: 'a0', createdAt: '2026-01-01T00:00:00Z' }),
      q('new-unplaced', { createdAt: '2026-10-01T00:00:00Z' }),
    ]
    expect(ids(showableQuotes(quotes, NOW))).toEqual(['placed', 'new-unplaced', 'old-unplaced'])
  })

  it('keeps a quote dated in the future hidden until its day, wherever it is placed', () => {
    const quotes = [
      q('later', { showOn: '2026-10-17T00:00:00Z', _order: 'a9' }),
      q('now', { _order: 'a1' }),
    ]
    expect(ids(showableQuotes(quotes, NOW))).toEqual(['now'])
    expect(ids(showableQuotes(quotes, new Date('2026-10-17T04:30:00Z')))).toEqual(['later', 'now'])
  })

  it('gives the same order whatever order they arrive in', () => {
    const quotes = [
      q('a', { _order: 'a1' }),
      q('b', { _order: 'a3' }),
      q('c', { _order: 'a2' }),
      q('d'),
    ]
    expect(ids(showableQuotes([...quotes].reverse(), NOW))).toEqual(
      ids(showableQuotes(quotes, NOW)),
    )
    expect(ids(showableQuotes(quotes, NOW))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('changes at India midnight, not UTC midnight', () => {
    const quotes = [
      q('d15', { showOn: '2026-10-15T00:00:00Z', _order: 'a1' }),
      q('d16', { showOn: '2026-10-16T00:00:00Z', _order: 'a2' }),
    ]
    expect(ids(showableQuotes(quotes, new Date('2026-10-15T18:00:00Z')))).toEqual(['d15']) // 23:30 IST
    expect(ids(showableQuotes(quotes, new Date('2026-10-15T18:31:00Z')))).toEqual(['d16', 'd15']) // 00:01 IST
  })

  it('does not change the list it is given', () => {
    const quotes = [q('a', { _order: 'a1' }), q('b', { _order: 'a2' })]
    showableQuotes(quotes, NOW)
    expect(ids(quotes)).toEqual(['a', 'b'])
  })
})
