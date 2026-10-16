/**
 * Pure helpers behind the Audios player's episode list: search, paging, clock and speed. Kept apart
 * from the component so they are unit-tested.
 */
export const PAGE_SIZE = 6
export const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const

/** The speed after `current` (1× → 1.25× → 1.5× → 2× → 0.75× → 1×). */
export function nextSpeed(current: number): number {
  const at = (SPEEDS as readonly number[]).indexOf(current)
  return SPEEDS[(at + 1) % SPEEDS.length]!
}

const fold = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/[​-‍⁠﻿]/g, '')
    .toLowerCase()

/**
 * Indexes (into `tracks`) of the episodes matching `query`: every word typed must appear in the
 * title or subtitle, ignoring case and invisible joiners. An empty query matches everything.
 */
export function filterTracks(
  tracks: Array<{ title: string; subtitle: string | null }>,
  query: string,
): number[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return tracks.flatMap((t, i) => {
    const haystack = fold(`${t.title} ${t.subtitle ?? ''}`)
    return words.every((w) => haystack.includes(w)) ? [i] : []
  })
}

export const pageCount = (total: number, size: number = PAGE_SIZE): number =>
  Math.max(1, Math.ceil(total / size))

/** Keep a 0-based page number inside what exists. */
export const clampPage = (page: number, total: number, size: number = PAGE_SIZE): number =>
  Math.min(Math.max(0, Math.floor(page) || 0), pageCount(total, size) - 1)

/** The 0-based page that shows position `position` of the (filtered) list. */
export const pageOfPosition = (position: number, size: number = PAGE_SIZE): number =>
  Math.max(0, Math.floor(position / size))

/** 4:05 · 1:02:03. Zero for anything that is not a usable time. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
