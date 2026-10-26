'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { EpisodeRow } from '@/components/home/audio/EpisodeRow'
import { PlayBar } from '@/components/home/audio/PlayBar'
import {
  isPlayable,
  SpotifyMark,
  type PlayerShow,
  type PlayerTrack,
} from '@/components/home/audio/parts'
import { embedUri, useSpotifyEmbed } from '@/components/home/audio/spotify-embed'
import { filterTracks, nextSpeed } from '@/lib/audio-list'

export type { PlayerShow, PlayerTrack }

/**
 * The Audios card: the section heading on a blue wash, then every episode in a scrolling list
 * (newest or oldest first, searchable) where each has its picture, title, blurb, date and length
 * and its own Share, Save, menu and Play buttons, as on a Spotify show page. Pressing Play opens
 * the player under the heading, at the top of the card, and starts the episode there: Spotify's
 * own player for a Spotify episode (driven from the Play button), or our controls (speed, ±seek,
 * previous / next, lock-screen keys) for audio hosted on this site or the media CDN. The card
 * keeps its size whatever it is doing, so the section beside it never moves. This component holds
 * the playback state; the pieces live in components/home/audio/.
 */
export function AudioPlayer({
  tracks,
  label,
  heading,
  show = null,
}: {
  tracks: PlayerTrack[]
  label: string
  /** The section heading, drawn at the top of the card. */
  heading?: ReactNode
  show?: PlayerShow | null
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const spotifyHost = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const wantPlay = useRef(false)
  const [current, setCurrent] = useState(0)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const track = tracks[current]!
  const results = useMemo(() => {
    const found = filterTracks(tracks, query)
    return newestFirst ? found : [...found].reverse()
  }, [tracks, query, newestFirst])
  // Previous / next and "play the next one" follow the order on screen.
  const playable = useMemo(() => results.filter((i) => isPlayable(tracks[i])), [results, tracks])

  const select = useCallback((index: number) => {
    setTime(0)
    setDuration(0)
    setFailed(false)
    setPlaying(false)
    setCurrent(index)
  }, [])

  const step = useCallback(
    (direction: 1 | -1, auto = false) => {
      if (!playable.length) return
      const to = playable.indexOf(current) + direction
      let next: number | undefined
      if (to >= 0 && to < playable.length) next = playable[to]
      else if (!auto) next = playable[(to + playable.length) % playable.length]
      if (next === undefined) {
        setPlaying(false)
        return
      }
      wantPlay.current = isPlayable(tracks[next])
      select(next)
    },
    [current, playable, select, tracks],
  )

  const spotify = useSpotifyEmbed({
    host: spotifyHost,
    uri: started && track.kind === 'spotify' ? embedUri(track.src) : null,
    tall: Boolean(track.tallEmbed),
    wantPlay,
    onState: (state) => {
      setPlaying(state.playing)
      setTime(state.position)
      setDuration(state.duration)
    },
    onEnd: () => step(1, true),
  })
  const { toggle: toggleSpotify, pause: pauseSpotify } = spotify

  const toggle = useCallback(() => {
    if (track.kind === 'spotify') {
      wantPlay.current = true
      toggleSpotify()
      return
    }
    const a = audio.current
    if (!a || track.kind !== 'file') return
    if (a.paused) {
      wantPlay.current = true
      a.play().catch(() => setPlaying(false))
    } else a.pause()
  }, [track.kind, toggleSpotify])

  const skip = (seconds: number) => {
    const a = audio.current
    if (!a || track.kind !== 'file') return
    const end = Number.isFinite(a.duration) ? a.duration : Infinity
    a.currentTime = Math.min(Math.max(0, a.currentTime + seconds), end)
  }

  /** Play button of an episode. */
  const choose = (index: number) => {
    const t = tracks[index]
    if (!t || t.kind === 'none') return
    if (t.kind === 'link') {
      if (t.src) window.open(t.src, '_blank', 'noopener,noreferrer')
      return
    }
    setStarted(true)
    // The player is at the top of the card: bring it into view if the page is scrolled past it.
    const head = top.current?.getBoundingClientRect()
    if (head && head.top < 0) window.scrollBy({ top: head.top - 88, behavior: 'smooth' }) // 88 = the sticky site header
    // The episode already in the player: pause / resume it. (A closed Spotify player starts again
    // through its own effect.)
    if (index === current && (t.kind === 'file' || started)) {
      toggle()
      return
    }
    wantPlay.current = true
    select(index)
  }

  const closeBar = () => {
    audio.current?.pause()
    pauseSpotify()
    wantPlay.current = false
    setPlaying(false)
    setStarted(false)
  }

  // A different episode was picked: start it if the visitor asked for playback, else stop the
  // element (its play/pause events keep `playing` in step).
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (track.kind === 'file') {
      if (wantPlay.current) a.play().catch(() => setPlaying(false))
    } else a.pause()
  }, [current, track.kind])

  // The chosen speed carries over to the next episode.
  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.defaultPlaybackRate = rate
    a.playbackRate = rate
  }, [rate, current])

  // Keep the episode that is playing in view in the list (scrolling the list, never the page).
  useEffect(() => {
    const box = list.current
    const row = box?.querySelector<HTMLElement>(
      `[data-track="${CSS.escape(tracks[current]?.id ?? '')}"]`,
    )
    if (!started || !box || !row) return
    if (row.offsetTop < box.scrollTop) box.scrollTo({ top: row.offsetTop })
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTo({ top: row.offsetTop + row.offsetHeight - box.clientHeight })
  }, [current, started, tracks])

  // Media keys / lock screen.
  const handlers = useRef({ toggle, step })
  useEffect(() => {
    handlers.current = { toggle, step }
  })
  useEffect(() => {
    if (!('mediaSession' in navigator) || track.kind !== 'file') return
    const session = navigator.mediaSession
    session.metadata = new MediaMetadata({
      title: track.title,
      artist: track.subtitle ?? '',
      artwork: track.art ? [{ src: track.art }] : [],
    })
    session.setActionHandler('play', () => handlers.current.toggle())
    session.setActionHandler('pause', () => handlers.current.toggle())
    session.setActionHandler('previoustrack', () => handlers.current.step(-1))
    session.setActionHandler('nexttrack', () => handlers.current.step(1))
    return () => {
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack'] as const)
        session.setActionHandler(action, null)
    }
  }, [track])

  // The ⋮ menu closes on a click elsewhere or Escape.
  useEffect(() => {
    if (menu === null) return
    const close = () => setMenu(null)
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('[data-menu]')) setMenu(null)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    // A floating menu would be left behind by a scroll or a resize: close it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  /** Under the ⋮ button, or above it when there is no room below; kept inside the screen. */
  const placeMenu = (id: string, button: DOMRect) => {
    const width = 208
    const height = 150
    const below = button.bottom + 6
    return {
      id,
      top: below + height > window.innerHeight ? Math.max(8, button.top - height - 6) : below,
      left: Math.min(Math.max(8, button.left), window.innerWidth - width - 8),
    }
  }

  const linkOf = (t: PlayerTrack): string | null =>
    t.spotifyLink ?? (t.href ? new URL(t.href, window.location.origin).toString() : null)

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Link copied')
    } catch {
      setNotice('Could not copy: use the address bar instead')
    }
  }

  const share = async (title: string, url: string | null) => {
    if (!url) return
    if (typeof navigator.share !== 'function') return copy(url)
    try {
      await navigator.share({ title, url })
    } catch {
      // Closed without sharing: nothing to report.
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-ink">
      <audio
        ref={audio}
        src={track.kind === 'file' ? (track.src ?? undefined) : undefined}
        preload="none"
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true)
          setPlaying(false)
        }}
        onEnded={() => step(1, true)}
      />

      {/* The heading, and under it the player once an episode is played. */}
      <div
        ref={top}
        className="shrink-0 border-b border-line bg-gradient-to-b from-brand-soft to-card px-4 pb-4 pt-5 sm:px-6 sm:pt-6"
      >
        {heading}
        <PlayBar
          open={started}
          track={track}
          showName={show?.name ?? null}
          canSkip={playable.length > 1}
          playing={playing}
          time={time}
          duration={duration}
          rate={rate}
          failed={failed}
          host={spotifyHost}
          embedFallback={spotify.unavailable}
          embedBlocked={spotify.blocked}
          onClose={closeBar}
          onStep={(direction) => step(direction)}
          onSkip={skip}
          onToggle={toggle}
          onSeek={(seconds) => {
            setTime(seconds)
            if (audio.current) audio.current.currentTime = seconds
          }}
          onRate={() => setRate((r) => nextSpeed(r))}
        />
      </div>

      {/* Sort and search. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-1 sm:px-6">
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          aria-label={`Sort episodes: ${newestFirst ? 'newest' : 'oldest'} first. Change`}
          className="inline-flex min-h-10 items-center gap-2.5 rounded-md text-start text-[0.95rem] font-bold text-ink transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
          <span>
            All episodes <span aria-hidden="true">·</span> {newestFirst ? 'Newest' : 'Oldest'}
          </span>
        </button>
        {tracks.length > 1 ? (
          <label className="relative block min-w-[9rem] flex-1">
            <span className="sr-only">Search episodes</span>
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search episodes"
              className="h-10 w-full rounded-full border border-line bg-canvas ps-9 pe-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </label>
        ) : null}
      </div>

      {/* Every episode; the list scrolls inside the card. */}
      <ul
        ref={list}
        aria-label={label}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 [scrollbar-width:thin] sm:px-6"
      >
        {results.map((index) => {
          const t = tracks[index]!
          const active = started && index === current
          return (
            <EpisodeRow
              key={t.id}
              track={t}
              active={active}
              playing={active && playing}
              loadedSeconds={t.kind === 'file' ? duration : 0}
              url={linkOf(t)}
              menuPos={menu?.id === t.id ? menu : null}
              onMenu={(button) => setMenu(menu?.id === t.id ? null : placeMenu(t.id, button))}
              onMenuClose={() => setMenu(null)}
              onChoose={() => choose(index)}
              onShare={() => void share(t.title, linkOf(t))}
              onCopy={() => {
                setMenu(null)
                const url = linkOf(t)
                if (url) void copy(url)
              }}
            />
          )
        })}
        {!results.length ? (
          <li className="py-8 text-center text-sm text-muted">No episodes found.</li>
        ) : null}
      </ul>

      {/* The channel itself: every episode, and Follow, on Spotify. */}
      {show ? (
        <a
          href={show.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 py-3 transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
        >
          <SpotifyMark className="size-7 shrink-0 text-[#1db954]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{show.name}</span>
            <span className="block truncate text-xs text-muted">All episodes on Spotify</span>
          </span>
          <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-brand/40 text-brand px-4 text-xs font-bold">
            Follow
          </span>
        </a>
      ) : null}

      <span role="status" className="sr-only">
        {notice ?? ''}
      </span>
      {notice ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-canvas shadow-lg">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
