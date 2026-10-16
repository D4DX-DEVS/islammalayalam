'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import {
  PAGE_SIZE,
  clampPage,
  clock,
  filterTracks,
  nextSpeed,
  pageCount,
  pageOfPosition,
} from '@/lib/audio-list'

export interface PlayerTrack {
  id: string
  title: string
  subtitle: string | null
  /** The post page; null for a quick entry that has none. */
  href: string | null
  /**
   * file = plays here · spotify = Spotify's own player, here · link = audio that cannot play inline
   * (opens in a new tab) · none = no audio added yet.
   */
  kind: 'file' | 'spotify' | 'link' | 'none'
  /** Audio file URL, the Spotify embed URL, or the external link. */
  src: string | null
  tallEmbed?: boolean
  /** Length entered by the editor ("18:24"); the real length replaces it once the file loads. */
  duration: string | null
  /** Cover URL for the lock screen / media keys. */
  art: string | null
  /** Server-rendered square artwork (placeholder and lazy loading included). */
  cover: ReactNode
  /** This episode on Spotify (feeds the Spotify button), if the editor added one. */
  spotifyLink: string | null
}

const SPOTIFY_GREEN = '#1ed760'

/** Spotify's mark (Simple Icons geometry, CC0). */
function SpotifyMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

const CONTROL =
  'inline-flex items-center justify-center rounded-full text-white/80 transition hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

function Equalizer() {
  return (
    <span className="flex h-4 items-end justify-center gap-0.5" aria-hidden="true">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] origin-bottom rounded-full motion-safe:animate-eq"
          style={{ animationDelay: `${delay}s`, backgroundColor: SPOTIFY_GREEN }}
        />
      ))}
    </span>
  )
}

/**
 * The Audios player (podcast style): the current episode's cover, title and progress with speed,
 * ±seek, previous / next and a Spotify button; below it a searchable, paged list of episodes. Audio
 * hosted on this site or the media CDN plays right here, Spotify links play in Spotify's own
 * embed, and an episode with no playable audio opens its article. Media keys and the lock screen
 * are wired through the Media Session API.
 */
export function AudioPlayer({
  tracks,
  label,
  heading,
  spotifyUrl,
}: {
  tracks: PlayerTrack[]
  half: boolean
  label: string
  /** The section heading, drawn inside the player's header. */
  heading?: ReactNode
  /** The show or playlist on Spotify, used when an episode has no Spotify link of its own. */
  spotifyUrl?: string | null
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const wantPlay = useRef(false)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const track = tracks[current]!
  const playable = useMemo(
    () => tracks.flatMap((t, i) => (t.kind === 'file' || t.kind === 'spotify' ? [i] : [])),
    [tracks],
  )
  const results = useMemo(() => filterTracks(tracks, query), [tracks, query])
  const pages = pageCount(results.length)
  const shownPage = clampPage(page, results.length)
  const visible = results.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE)
  const spotifyHref = track.spotifyLink ?? spotifyUrl ?? null
  /** Only hosted audio is controlled by our own buttons; Spotify has its own player. */
  const canPlay = track.kind === 'file'

  /** Switch episode: clear the clock and any error. */
  const select = useCallback((index: number) => {
    setTime(0)
    setDuration(0)
    setFailed(false)
    setCurrent(index)
  }, [])

  /** Turn to the list page that holds this episode (when the search still shows it). */
  const reveal = useCallback(
    (index: number) => {
      const at = results.indexOf(index)
      if (at >= 0) setPage(pageOfPosition(at))
    },
    [results],
  )

  const toggle = useCallback(() => {
    const a = audio.current
    if (!a || track.kind !== 'file') return
    if (a.paused) {
      wantPlay.current = true
      a.play().catch(() => setPlaying(false))
    } else a.pause()
  }, [track.kind])

  const step = useCallback(
    (direction: 1 | -1, auto = false) => {
      if (!playable.length) return
      const at = playable.indexOf(current)
      const to = at + direction
      let next: number | undefined
      if (to >= 0 && to < playable.length) next = playable[to]
      else if (!auto) next = playable[(to + playable.length) % playable.length]
      if (next === undefined) {
        setPlaying(false)
        return
      }
      wantPlay.current = true
      select(next)
      reveal(next)
    },
    [current, playable, reveal, select],
  )

  const skip = (seconds: number) => {
    const a = audio.current
    if (!a || track.kind !== 'file') return
    const end = Number.isFinite(a.duration) ? a.duration : Infinity
    a.currentTime = Math.min(Math.max(0, a.currentTime + seconds), end)
  }

  const choose = (index: number) => {
    if (index === current) {
      toggle()
      return
    }
    wantPlay.current = tracks[index]?.kind === 'file'
    select(index)
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

  const fill = duration > 0 ? `${Math.min(100, (time / duration) * 100)}%` : '0%'
  // "speaker · show · N episodes" — without repeating the show's name when the episode's category is the same.
  const meta = [
    ...new Set(
      [
        track.subtitle,
        label,
        `${tracks.length} ${tracks.length === 1 ? 'episode' : 'episodes'}`,
      ].filter((part): part is string => Boolean(part)),
    ),
  ].join(' · ')

  return (
    <div className="text-white">
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

      {/* Header: cover, title, progress and controls on a blue wash that fades into the list. */}
      <div className="bg-gradient-to-b from-[#1d4fb0] via-[#142f6b] to-[#121212] px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
        {heading ? <div className="-mb-1">{heading}</div> : null}
        <div className="flex items-end gap-4 sm:gap-5">
          <div
            className={`relative size-24 shrink-0 overflow-hidden rounded-md bg-white shadow-[0_14px_30px_-10px_rgb(0_0_0/0.7)] ring-1 ring-black/10 transition-transform duration-500 sm:size-36 ${playing ? 'scale-100' : 'scale-[0.97]'}`}
          >
            {track.cover}
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-white/70 sm:text-[0.7rem]">
              Audio · Episode {current + 1}
            </p>
            <h3 className="mt-1 line-clamp-3 text-lg font-extrabold leading-snug text-white sm:text-[1.7rem] sm:leading-[1.25]">
              {track.title}
            </h3>
            <p className="mt-1.5 truncate text-xs text-white/70 sm:text-sm">{meta}</p>
          </div>
        </div>

        {track.kind === 'spotify' && track.src ? (
          <div className="mt-5">
            <iframe
              src={track.src}
              title={track.title}
              loading="lazy"
              allow="encrypted-media; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className={`w-full rounded-xl border-0 ${track.tallEmbed ? 'h-[352px]' : 'h-[152px]'}`}
            />
          </div>
        ) : track.kind === 'link' && track.src ? (
          <a
            href={track.src}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1426] transition hover:scale-105 active:scale-95"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open audio
          </a>
        ) : (
          <div className="mt-5 flex items-center gap-3">
            <span className="w-11 shrink-0 text-xs tabular-nums text-white/75">{clock(time)}</span>
            <input
              type="range"
              className="range-player min-w-0 flex-1"
              aria-label="Progress"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(time, duration || 1)}
              disabled={!duration}
              style={{ '--fill': fill } as CSSProperties}
              onChange={(e) => {
                const t = Number(e.target.value)
                setTime(t)
                if (audio.current) audio.current.currentTime = t
              }}
            />
            <span className="w-11 shrink-0 text-end text-xs tabular-nums text-white/75">
              {duration ? clock(duration) : (track.duration ?? '--:--')}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            {track.kind === 'file' ? (
              <button
                type="button"
                onClick={() => setRate((r) => nextSpeed(r))}
                aria-label={`Playback speed ${rate}×. Change speed`}
                className={`${CONTROL} h-8 min-w-11 border border-white/30 px-3 text-xs font-bold`}
              >
                {rate}×
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1 sm:gap-2.5">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous episode"
              disabled={playable.length < 2}
              className={`${CONTROL} size-9`}
            >
              <SkipBack className="size-[1.1rem] fill-current" aria-hidden="true" />
            </button>
            {track.kind === 'file' || track.kind === 'none' ? (
              <>
                <button
                  type="button"
                  onClick={() => skip(-10)}
                  disabled={!canPlay}
                  aria-label="Back 10 seconds"
                  className={`${CONTROL} h-9 px-1.5 text-xs font-semibold`}
                >
                  −10s
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!canPlay}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="inline-flex size-14 items-center justify-center rounded-full text-[#0b0b0b] shadow-lg transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-40"
                  style={{ backgroundColor: SPOTIFY_GREEN }}
                >
                  {playing ? (
                    <Pause className="size-6 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="ms-0.5 size-6 fill-current" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => skip(30)}
                  disabled={!canPlay}
                  aria-label="Forward 30 seconds"
                  className={`${CONTROL} h-9 px-1.5 text-xs font-semibold`}
                >
                  +30s
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next episode"
              disabled={playable.length < 2}
              className={`${CONTROL} size-9`}
            >
              <SkipForward className="size-[1.1rem] fill-current" aria-hidden="true" />
            </button>
          </div>

          <div className="flex justify-end">
            {spotifyHref ? (
              <a
                href={spotifyHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open on Spotify"
                title="Open on Spotify"
                className={`${CONTROL} size-9`}
              >
                <SpotifyMark className="size-6" />
              </a>
            ) : null}
          </div>
        </div>
        {track.kind === 'none' ? (
          <p role="status" className="mt-3 text-center text-xs text-white/60">
            The audio for this episode is not available yet.
          </p>
        ) : null}
        {failed ? (
          <p role="alert" className="mt-3 text-xs text-amber-300">
            ഈ ഓഡിയോ ലോഡ് ചെയ്യാനായില്ല.{' '}
            {track.href ? (
              <Link href={track.href} className="underline">
                ലേഖനം തുറക്കുക
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Episodes: search, the list (one page at a time) and paging. */}
      <div className="px-4 pb-5 sm:px-6 sm:pb-6">
        {tracks.length > 1 ? (
          <label className="relative block">
            <span className="sr-only">Search episodes</span>
            <Search
              className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-white/45"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Search episodes"
              className="h-11 w-full rounded-full border border-white/15 bg-[#1c1c1c] ps-10 pe-4 text-sm text-white placeholder:text-white/45 focus:border-white/45 focus:outline-none"
            />
          </label>
        ) : null}

        <ul className="mt-3">
          {visible.map((index) => {
            const t = tracks[index]!
            const active = index === current
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => choose(index)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${active ? 'bg-white/[0.07]' : ''} ${t.kind === 'none' ? 'opacity-60' : ''}`}
                >
                  <span className="w-7 shrink-0 text-center text-sm tabular-nums text-white/55">
                    {active && playing ? (
                      <Equalizer />
                    ) : (
                      <>
                        <span className="group-hover:hidden">{index + 1}</span>
                        <Play
                          className="mx-auto hidden size-4 fill-current text-white group-hover:block"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[0.95rem] font-medium"
                      style={active ? { color: SPOTIFY_GREEN } : undefined}
                    >
                      {t.title}
                    </span>
                    {t.subtitle ? (
                      <span className="block truncate text-xs text-white/55">{t.subtitle}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-white/55">
                    {t.kind === 'spotify' ? (
                      <SpotifyMark className="size-4" />
                    ) : t.kind === 'link' ? (
                      <ExternalLink className="size-4" aria-hidden="true" />
                    ) : t.kind === 'none' ? (
                      'Soon'
                    ) : active && duration ? (
                      clock(duration)
                    ) : (
                      (t.duration ?? '')
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!visible.length ? (
          <p className="py-6 text-center text-sm text-white/55">No episodes found.</p>
        ) : null}

        {pages > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-white/60">
            <button
              type="button"
              onClick={() => setPage(shownPage - 1)}
              disabled={shownPage === 0}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-4 font-semibold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Prev
            </button>
            <span className="tabular-nums">
              {shownPage + 1} / {pages} · {results.length} episodes
            </span>
            <button
              type="button"
              onClick={() => setPage(shownPage + 1)}
              disabled={shownPage >= pages - 1}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-4 font-semibold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
