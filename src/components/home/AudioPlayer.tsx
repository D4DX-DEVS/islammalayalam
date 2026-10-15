'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'

export interface PlayerTrack {
  id: string
  title: string
  subtitle: string | null
  /** The post page. */
  href: string
  /** file = plays here · spotify = Spotify embed · page = no playable audio, listen on its page. */
  kind: 'file' | 'spotify' | 'page'
  /** Audio file URL, or the Spotify embed URL. */
  src: string | null
  tallEmbed?: boolean
  /** Length entered by the editor ("18:24"); the real length replaces it once the file loads. */
  duration: string | null
  /** Cover URL for the lock-screen / media keys. */
  art: string | null
  /** Server-rendered square artwork: large (now playing) and small (queue row). */
  cover: ReactNode
  thumb: ReactNode
}

type RepeatMode = 'off' | 'all' | 'one'

const mmss = (seconds: number) =>
  !Number.isFinite(seconds) || seconds < 0
    ? '0:00'
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

const ICON_BUTTON =
  'inline-flex size-9 items-center justify-center rounded-full text-white/70 transition hover:scale-110 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-35'

function Equalizer() {
  return (
    <span className="flex h-4 items-end justify-center gap-0.5" aria-hidden="true">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] origin-bottom rounded-full bg-[#6db3ff] motion-safe:animate-eq"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

/**
 * Spotify-style player for the Audios shelf: "now playing" card (artwork, title, progress, shuffle /
 * previous / play / next / repeat, volume) beside a numbered queue. Audio files hosted on this site
 * or the media CDN play right here, Spotify links show Spotify's own embed, and a track with no
 * playable audio opens its article. Media keys and the lock screen are wired through the Media Session API.
 */
export function AudioPlayer({
  tracks,
  half,
  label,
}: {
  tracks: PlayerTrack[]
  half: boolean
  label: string
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const wantPlay = useRef(false)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.9)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [failed, setFailed] = useState(false)

  const track = tracks[current]!
  const playable = tracks.flatMap((t, i) => (t.kind === 'page' ? [] : [i]))

  /** Switch track: clear the clock and any error. */
  const select = useCallback((index: number) => {
    setTime(0)
    setDuration(0)
    setFailed(false)
    setCurrent(index)
  }, [])

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
      let next: number | undefined
      if (shuffle && playable.length > 1) {
        const others = playable.filter((i) => i !== current)
        next = others[Math.floor(Math.random() * others.length)]
      } else {
        const to = at + direction
        if (to >= 0 && to < playable.length) next = playable[to]
        else if (repeat === 'all' || !auto)
          next = playable[(to + playable.length) % playable.length]
      }
      if (next === undefined) {
        setPlaying(false)
        return
      }
      wantPlay.current = true
      select(next)
    },
    [current, playable, repeat, select, shuffle],
  )

  const choose = (index: number) => {
    if (index === current) {
      toggle()
      return
    }
    wantPlay.current = tracks[index]?.kind === 'file'
    select(index)
  }

  // A different track was picked: start it if the visitor asked for playback, else stop the element
  // (its play/pause events keep `playing` in step).
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (track.kind === 'file') {
      if (wantPlay.current) a.play().catch(() => setPlaying(false))
    } else a.pause()
  }, [current, track.kind])

  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.volume = volume
    a.muted = muted
  }, [volume, muted])

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

  const cycleRepeat = () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  const fill = duration > 0 ? `${Math.min(100, (time / duration) * 100)}%` : '0%'
  const loud = muted || volume === 0

  return (
    <div
      className={`grid gap-6 ${half ? '' : 'lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-8'}`}
    >
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
        onEnded={(e) => {
          if (repeat === 'one') {
            e.currentTarget.currentTime = 0
            void e.currentTarget.play()
          } else step(1, true)
        }}
      />

      {/* Now playing */}
      <div className={`flex gap-5 ${half ? 'items-start' : 'flex-col'}`}>
        <div
          className={`relative shrink-0 ${half ? 'w-32 sm:w-44' : 'mx-auto w-full max-w-[17rem]'}`}
        >
          <div
            className={`absolute -inset-3 rounded-3xl bg-sky-400/30 blur-2xl transition-opacity duration-700 ${playing ? 'opacity-100' : 'opacity-40'}`}
            aria-hidden="true"
          />
          <div
            className={`relative aspect-square overflow-hidden rounded-lg shadow-[0_18px_40px_-12px_rgb(0_0_0/0.75)] ring-1 ring-white/10 transition-transform duration-500 ${playing ? 'scale-100' : 'scale-[0.96]'}`}
          >
            {track.cover}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/55">
              {playing ? 'ഇപ്പോൾ കേൾക്കുന്നു' : label}
            </p>
            <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug text-white sm:text-xl">
              {track.title}
            </h3>
            {track.subtitle ? (
              <p className="mt-1 truncate text-sm text-white/65">{track.subtitle}</p>
            ) : null}
          </div>

          {track.kind === 'spotify' && track.src ? (
            <iframe
              src={track.src}
              title={track.title}
              loading="lazy"
              allow="encrypted-media; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className={`w-full rounded-xl border-0 ${track.tallEmbed ? 'h-[352px]' : 'h-[152px]'}`}
            />
          ) : track.kind === 'page' ? (
            <Link
              href={track.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1426] transition hover:scale-105 active:scale-95"
            >
              <Play className="size-4 fill-current" aria-hidden="true" />
              ഓഡിയോ കേൾക്കുക
            </Link>
          ) : (
            <>
              <div>
                <input
                  type="range"
                  className="range-player"
                  aria-label="പുരോഗതി"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={Math.min(time, duration || 1)}
                  disabled={!duration}
                  style={{ '--fill': fill } as React.CSSProperties}
                  onChange={(e) => {
                    const t = Number(e.target.value)
                    setTime(t)
                    if (audio.current) audio.current.currentTime = t
                  }}
                />
                <div className="flex justify-between text-[0.7rem] tabular-nums text-white/60">
                  <span>{mmss(time)}</span>
                  <span>{duration ? mmss(duration) : (track.duration ?? '--:--')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => setShuffle((v) => !v)}
                  aria-pressed={shuffle}
                  aria-label="ഷഫിൾ"
                  className={`${ICON_BUTTON} ${shuffle ? '!text-[#6db3ff]' : ''}`}
                >
                  <Shuffle className="size-[1.1rem]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="മുമ്പത്തേത്"
                  className={ICON_BUTTON}
                >
                  <SkipBack className="size-5 fill-current" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? 'നിർത്തുക' : 'പ്ലേ ചെയ്യുക'}
                  className="inline-flex size-14 items-center justify-center rounded-full bg-white text-[#0b1426] shadow-lg transition hover:scale-105 active:scale-95"
                >
                  {playing ? (
                    <Pause className="size-6 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="ms-0.5 size-6 fill-current" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="അടുത്തത്"
                  className={ICON_BUTTON}
                >
                  <SkipForward className="size-5 fill-current" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={cycleRepeat}
                  aria-label="ആവർത്തിക്കുക"
                  aria-pressed={repeat !== 'off'}
                  className={`${ICON_BUTTON} ${repeat !== 'off' ? '!text-[#6db3ff]' : ''}`}
                >
                  {repeat === 'one' ? (
                    <Repeat1 className="size-[1.1rem]" aria-hidden="true" />
                  ) : (
                    <Repeat className="size-[1.1rem]" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label="ശബ്ദം"
                  aria-pressed={muted}
                  className={ICON_BUTTON}
                >
                  {loud ? (
                    <VolumeX className="size-[1.1rem]" aria-hidden="true" />
                  ) : (
                    <Volume2 className="size-[1.1rem]" aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  className="range-player max-w-32"
                  aria-label="ശബ്ദം"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  style={{ '--fill': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                  onChange={(e) => {
                    setVolume(Number(e.target.value))
                    setMuted(false)
                  }}
                />
              </div>
              {failed ? (
                <p role="alert" className="text-xs text-amber-300">
                  ഈ ഓഡിയോ ലോഡ് ചെയ്യാനായില്ല.{' '}
                  <Link href={track.href} className="underline">
                    ലേഖനം തുറക്കുക
                  </Link>
                </p>
              ) : null}
            </>
          )}

          {track.kind !== 'file' && playable.length > 1 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="മുമ്പത്തേത്"
                className={ICON_BUTTON}
              >
                <SkipBack className="size-5 fill-current" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="അടുത്തത്"
                className={ICON_BUTTON}
              >
                <SkipForward className="size-5 fill-current" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Queue */}
      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/50">
          <span className="w-8 text-center">#</span>
          <span>ശീർഷകം</span>
        </div>
        <ul className="mt-1 max-h-[26rem] space-y-0.5 overflow-y-auto pe-1">
          {tracks.map((t, i) => {
            const active = i === current
            const row = `group flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition-colors hover:bg-white/10 ${active ? 'bg-white/10' : ''}`
            const body = (
              <>
                <span className="w-8 shrink-0 text-center text-sm tabular-nums text-white/60">
                  {active && playing ? (
                    <Equalizer />
                  ) : (
                    <>
                      <span
                        className={
                          active ? 'text-[#6db3ff] group-hover:hidden' : 'group-hover:hidden'
                        }
                      >
                        {i + 1}
                      </span>
                      <Play
                        className="mx-auto hidden size-4 fill-current text-white group-hover:block"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </span>
                <span className="size-11 shrink-0 overflow-hidden rounded">{t.thumb}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[0.95rem] font-semibold ${active ? 'text-[#6db3ff]' : 'text-white'}`}
                  >
                    {t.title}
                  </span>
                  {t.subtitle ? (
                    <span className="block truncate text-xs text-white/55">{t.subtitle}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-white/50">
                  {t.kind === 'spotify' ? (
                    'Spotify'
                  ) : t.kind === 'page' ? (
                    <ExternalLink className="size-4" aria-hidden="true" />
                  ) : active && duration ? (
                    <span className="tabular-nums">{mmss(duration)}</span>
                  ) : t.duration ? (
                    <span className="tabular-nums">{t.duration}</span>
                  ) : null}
                </span>
              </>
            )
            return (
              <li key={t.id} data-reveal="left">
                <button
                  type="button"
                  className={row}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => choose(i)}
                >
                  {body}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
