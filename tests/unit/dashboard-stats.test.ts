import { describe, expect, it } from 'vitest'
import {
  axisLabelIndexes,
  bucketSums,
  compact,
  dailyCounts,
  dayKey,
  full,
  latestDate,
  monotonePath,
  niceScale,
  shareLabel,
  yearCounts,
} from '@/payload/admin/dashboardStats'

// 15 Oct 2026, 10:00 India time.
const NOW = new Date('2026-10-15T04:30:00Z')

describe('dayKey', () => {
  it('uses the India calendar day, not UTC', () => {
    // 19:00 UTC on the 14th is already 00:30 on the 15th in India.
    expect(dayKey('2026-10-14T19:00:00Z')).toBe('2026-10-15')
    expect(dayKey('2026-10-14T18:29:00Z')).toBe('2026-10-14')
  })

  it('returns null for empty or invalid input', () => {
    expect(dayKey(null)).toBeNull()
    expect(dayKey(undefined)).toBeNull()
    expect(dayKey('')).toBeNull()
    expect(dayKey('not a date')).toBeNull()
  })
})

describe('dailyCounts', () => {
  it('returns one bucket per day, oldest first, ending today, zeros included', () => {
    const out = dailyCounts([], 14, NOW)
    expect(out).toHaveLength(14)
    expect(out[0]!.key).toBe('2026-10-02')
    expect(out.at(-1)!.key).toBe('2026-10-15')
    expect(out.every((d) => d.count === 0)).toBe(true)
    expect(out.at(-1)!.label).toBe('15 Oct')
  })

  it('counts each date in its day and ignores dates outside the window or invalid', () => {
    const out = dailyCounts(
      [
        '2026-10-15T01:00:00Z',
        '2026-10-15T03:00:00Z',
        '2026-10-14T05:00:00Z',
        '2026-09-01T00:00:00Z',
        '2027-01-01T00:00:00Z',
        'junk',
        null,
      ],
      14,
      NOW,
    )
    expect(out.find((d) => d.key === '2026-10-15')!.count).toBe(2)
    expect(out.find((d) => d.key === '2026-10-14')!.count).toBe(1)
    expect(out.reduce((sum, d) => sum + d.count, 0)).toBe(3)
  })

  it('never returns an empty window', () => {
    expect(dailyCounts([], 0, NOW)).toHaveLength(1)
  })
})

describe('yearCounts', () => {
  it('fills the empty years between the first year with data and now', () => {
    const out = yearCounts(
      ['2024-05-01T00:00:00Z', '2024-06-01T00:00:00Z', '2026-01-02T00:00:00Z'],
      NOW,
    )
    expect(out).toEqual([
      { year: 2024, count: 2 },
      { year: 2025, count: 0 },
      { year: 2026, count: 1 },
    ])
  })

  it('is empty without any valid date', () => {
    expect(yearCounts([], NOW)).toEqual([])
    expect(yearCounts([null, 'junk'], NOW)).toEqual([])
  })

  it('keeps only the last maxYears years', () => {
    const out = yearCounts(['2010-01-01T00:00:00Z', '2025-01-01T00:00:00Z'], NOW, 3)
    expect(out.map((y) => y.year)).toEqual([2024, 2025, 2026])
    expect(out.find((y) => y.year === 2025)!.count).toBe(1)
  })

  it('buckets by India year at the new-year boundary', () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India.
    const out = yearCounts(['2025-12-31T20:00:00Z'], NOW)
    expect(out).toEqual([{ year: 2026, count: 1 }])
  })
})

describe('latestDate', () => {
  it('returns the newest valid date as ISO', () => {
    expect(latestDate(['2020-01-01T00:00:00Z', '2022-03-04T05:06:07Z', 'junk', null])).toBe(
      '2022-03-04T05:06:07.000Z',
    )
  })

  it('is null when nothing is valid', () => {
    expect(latestDate([])).toBeNull()
    expect(latestDate([null, '', 'junk'])).toBeNull()
  })
})

describe('shareLabel', () => {
  it('formats shares readably', () => {
    expect(shareLabel(443, 489)).toBe('91%')
    expect(shareLabel(35, 489)).toBe('7.2%')
    expect(shareLabel(4, 489)).toBe('<1%')
    expect(shareLabel(7, 489)).toBe('1.4%')
    expect(shareLabel(0, 489)).toBe('0%')
    expect(shareLabel(5, 0)).toBe('0%')
  })
})

describe('compact / full', () => {
  it('keeps full digits below 10,000 and compacts above', () => {
    expect(compact(0)).toBe('0')
    expect(compact(1284)).toBe('1,284')
    expect(compact(9999)).toBe('9,999')
    expect(compact(12_934)).toBe('12.9K')
    expect(compact(1_200_000)).toBe('1.2M')
  })

  it('guards non-finite values', () => {
    expect(compact(Number.NaN)).toBe('0')
    expect(full(Number.POSITIVE_INFINITY)).toBe('0')
    expect(full(12_934)).toBe('12,934')
  })
})

describe('niceScale', () => {
  it('rounds the maximum up to a clean step', () => {
    expect(niceScale(166)).toEqual({ max: 200, ticks: [0, 50, 100, 150, 200] })
    expect(niceScale(100)).toEqual({ max: 100, ticks: [0, 50, 100] })
  })

  it('never uses fractional ticks for small counts', () => {
    const { ticks } = niceScale(3)
    expect(ticks).toEqual([0, 1, 2, 3])
    expect(ticks.every(Number.isInteger)).toBe(true)
  })

  it('handles zero and invalid maxima', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
    expect(niceScale(Number.NaN)).toEqual({ max: 1, ticks: [0, 1] })
    expect(niceScale(-5)).toEqual({ max: 1, ticks: [0, 1] })
  })

  it('always covers the data maximum', () => {
    for (const max of [1, 2, 7, 13, 99, 101, 489, 1000, 7312]) {
      expect(niceScale(max).max).toBeGreaterThanOrEqual(max)
    }
  })
})

describe('monotonePath', () => {
  it('starts at the first point and ends at the last', () => {
    const d = monotonePath([
      [0, 100],
      [50, 0],
      [100, 100],
    ])
    expect(d.startsWith('M 0 100')).toBe(true)
    expect(d.endsWith('100 100')).toBe(true)
  })

  it('never overshoots: every control point stays inside the plot box', () => {
    // 0, 1, 0, 1 posts per day in a 100-box whose y grows downwards.
    const d = monotonePath([
      [0, 100],
      [33.33, 0],
      [66.67, 100],
      [100, 0],
    ])
    const ys = d
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number)
      .filter((_, i) => i % 2 === 1)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(100)
  })

  it('handles the degenerate cases', () => {
    expect(monotonePath([])).toBe('')
    expect(monotonePath([[5, 5]])).toBe('M 5 5')
    expect(
      monotonePath([
        [0, 50],
        [100, 50],
      ]),
    ).toBe('M 0 50 C 33.33 50 66.67 50 100 50')
  })
})

describe('axisLabelIndexes', () => {
  it('always prints the first and the last', () => {
    expect([...axisLabelIndexes(1)]).toEqual([0])
    expect([...axisLabelIndexes(2)]).toEqual([0, 1])
  })

  it('spaces about five labels and keeps the last clear of its neighbour', () => {
    expect([...axisLabelIndexes(30)].sort((a, b) => a - b)).toEqual([0, 7, 14, 21, 29])
    expect([...axisLabelIndexes(29)].sort((a, b) => a - b)).toEqual([0, 7, 14, 21, 28])
  })
})

describe('bucketSums', () => {
  it('sums consecutive runs into equal buckets', () => {
    expect(bucketSums([1, 1, 1, 2, 2, 2], 2)).toEqual([3, 6])
    expect(bucketSums([1, 2, 3, 4, 5], 2)).toEqual([6, 9])
  })

  it('never makes more buckets than values', () => {
    expect(bucketSums([4], 10)).toEqual([4])
    expect(bucketSums([], 3)).toEqual([])
  })
})
