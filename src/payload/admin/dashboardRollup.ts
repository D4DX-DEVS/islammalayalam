import 'server-only'
import type { Payload } from 'payload'
import { CONTENT_TYPES, contentType, type ContentFormat } from '@/cms/content-types'
import type { As, AuthorCount, FormatCount } from './dashboardData'
import { dailyCounts, latestDate, yearCounts, type YearCount } from './dashboardStats'

/**
 * The dashboard's roll-up over every published post: one three-field read (date, kind, byline)
 * feeds the by-year chart, the content mix, "last published", the 30-day trend and the top bylines.
 * Runs as the signed-in user, like the rest of dashboardData.ts.
 */
/** Upper bound for the roll-up read. */
const ROLLUP_LIMIT = 20_000
export const TREND_DAYS = 30
const TOP_AUTHORS = 6

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Always every kind, in the registry's order, so the chart's legend is stable. */
const formatCounts = (byFormat: Partial<Record<ContentFormat, number>>): FormatCount[] =>
  CONTENT_TYPES.map((type) => ({
    key: type.key,
    label: type.plural,
    count: byFormat[type.key] ?? 0,
  }))

export const emptyRollup = (now = new Date()) => ({
  years: [] as YearCount[],
  lastPublishedAt: null as string | null,
  formats: formatCounts({}),
  published30: 0,
  publishedPrev30: 0,
  daily30: dailyCounts([], TREND_DAYS, now),
  topAuthors: [] as AuthorCount[],
  authorsWindow: 'month' as 'month' | 'all',
})

export type Rollup = ReturnType<typeof emptyRollup>

/** Rank the ids by count, highest first, and keep the top few. */
const topOf = (counts: Map<string, number>): Array<[string, number]> =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_AUTHORS)

export async function loadRollup(payload: Payload, as: As, now = new Date()): Promise<Rollup> {
  const res = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    select: { publishedAt: true, format: true, author: true },
    depth: 0,
    pagination: false,
    limit: ROLLUP_LIMIT,
    ...as,
  })
  const docs = res.docs as Array<{
    publishedAt?: string | null
    format?: string | null
    author?: string | null
  }>
  const dates = docs.map((d) => d.publishedAt)
  const byFormat: Partial<Record<ContentFormat, number>> = {}
  const monthStart = now.getTime() - TREND_DAYS * 86_400_000
  const prevStart = monthStart - TREND_DAYS * 86_400_000
  let published30 = 0
  let publishedPrev30 = 0
  const month = new Map<string, number>()
  const all = new Map<string, number>()
  for (const d of docs) {
    // Posts saved before the kind field existed count as articles (contentType's fallback).
    const key = contentType(d.format).key
    byFormat[key] = (byFormat[key] ?? 0) + 1
    const t = d.publishedAt ? Date.parse(d.publishedAt) : NaN
    const author = typeof d.author === 'string' ? d.author : ''
    if (author) all.set(author, (all.get(author) ?? 0) + 1)
    if (Number.isNaN(t) || t > now.getTime()) continue
    if (t >= monthStart) {
      published30 += 1
      if (author) month.set(author, (month.get(author) ?? 0) + 1)
    } else if (t >= prevStart) publishedPrev30 += 1
  }
  const authorsWindow = month.size ? ('month' as const) : ('all' as const)
  const ranked = topOf(authorsWindow === 'month' ? month : all)
  const names = new Map<string, string>()
  if (ranked.length) {
    const authors = await payload.find({
      collection: 'authors',
      where: { id: { in: ranked.map(([id]) => id) } },
      select: { name: true },
      depth: 0,
      pagination: false,
      limit: TOP_AUTHORS,
      ...as,
    })
    for (const a of authors.docs) names.set(String(a.id), str((a as { name?: unknown }).name))
  }
  return {
    years: yearCounts(dates, now),
    lastPublishedAt: latestDate(dates),
    formats: formatCounts(byFormat),
    published30,
    publishedPrev30,
    daily30: dailyCounts(dates, TREND_DAYS, now),
    topAuthors: ranked
      .filter(([id]) => names.has(id))
      .map(([id, posts]) => ({ id, name: names.get(id) || '(unnamed)', posts })),
    authorsWindow,
  }
}
