import { describe, expect, it } from 'vitest'
import { pickDailyQuote } from '@/features/quotes/pick'
import { istDayKey } from '@/lib/quote'

// 16 Oct 2026, 10:00 India time.
const NOW = new Date('2026-10-16T04:30:00Z')
const q = (id: string, showOn?: string, createdAt = '2026-01-01T00:00:00Z') => ({
  id,
  showOn: showOn ?? null,
  createdAt,
})

describe('istDayKey', () => {
  it('uses the India calendar day', () => {
    expect(istDayKey('2026-10-15T19:00:00Z')).toBe('2026-10-16') // 00:30 IST
    expect(istDayKey('2026-10-15T18:29:00Z')).toBe('2026-10-15')
    expect(istDayKey(null)).toBeNull()
    expect(istDayKey('')).toBeNull()
    expect(istDayKey('nope')).toBeNull()
  })
})

describe('pickDailyQuote', () => {
  it('returns null with nothing to show', () => {
    expect(pickDailyQuote([], NOW)).toBeNull()
    expect(pickDailyQuote([q('a', '2026-10-20')], NOW)).toBeNull() // only a future quote
  })

  it('prefers the quote scheduled for today over the rotation', () => {
    const quotes = [q('plain'), q('today', '2026-10-16T06:30:00Z'), q('other', '2026-10-17')]
    expect(pickDailyQuote(quotes, NOW)?.id).toBe('today')
  })

  it('takes the newest when several are scheduled for today', () => {
    const quotes = [
      q('old', '2026-10-16', '2026-10-01T00:00:00Z'),
      q('new', '2026-10-16', '2026-10-10T00:00:00Z'),
    ]
    expect(pickDailyQuote(quotes, NOW)?.id).toBe('new')
  })

  it('cycles through the undated quotes, one per day, the same all day', () => {
    const quotes = ['a', 'b', 'c'].map((id, i) => q(id, undefined, `2026-01-0${i + 1}T00:00:00Z`))
    const day = (iso: string) => pickDailyQuote(quotes, new Date(iso))?.id
    const first = day('2026-10-16T01:00:00Z')
    expect(day('2026-10-16T17:00:00Z')).toBe(first) // same IST day (ends 18:30 UTC)
    const seen = new Set([first, day('2026-10-17T05:00:00Z'), day('2026-10-18T05:00:00Z')])
    expect(seen.size).toBe(3)
    expect(day('2026-10-19T05:00:00Z')).toBe(first) // wraps after three days
  })

  it('does not depend on the order the quotes arrive in', () => {
    const quotes = ['a', 'b', 'c', 'd'].map((id, i) =>
      q(id, undefined, `2026-01-0${i + 1}T00:00:00Z`),
    )
    expect(pickDailyQuote([...quotes].reverse(), NOW)?.id).toBe(pickDailyQuote(quotes, NOW)?.id)
  })

  it('ignores dated quotes for other days when undated ones exist', () => {
    const quotes = [q('plain'), q('yesterday', '2026-10-15'), q('tomorrow', '2026-10-17')]
    expect(pickDailyQuote(quotes, NOW)?.id).toBe('plain')
  })

  it('falls back to the most recent past quote when nothing else qualifies', () => {
    const quotes = [q('a', '2026-10-01'), q('b', '2026-10-12'), q('c', '2026-10-30')]
    expect(pickDailyQuote(quotes, NOW)?.id).toBe('b')
  })

  it('changes at India midnight, not UTC midnight', () => {
    const quotes = [q('d15', '2026-10-15'), q('d16', '2026-10-16')]
    expect(pickDailyQuote(quotes, new Date('2026-10-15T18:00:00Z'))?.id).toBe('d15') // 23:30 IST
    expect(pickDailyQuote(quotes, new Date('2026-10-15T18:31:00Z'))?.id).toBe('d16') // 00:01 IST
  })
})
