import type { CSSProperties, RefObject } from 'react'
import Link from 'next/link'
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { clock } from '@/lib/audio-list'
import { CONTROL, ICON_BTN, SPOTIFY_GREEN, type PlayerTrack } from './parts'

/**
 * The player at the top of the card (where a show's header would be): hidden until an episode is
 * played. A Spotify episode plays in Spotify's own embedded player, started from the Play button
 * in the list (`host` is where it is mounted: it stays in the page while closed so the same player
 * is reused); audio hosted here gets our controls: progress, speed, ±seek, previous / next.
 */
export function PlayBar({
  open,
  track,
  showName,
  canSkip,
  playing,
  time,
  duration,
  rate,
  failed,
  host,
  embedFallback,
  embedBlocked,
  onClose,
  onStep,
  onSkip,
  onToggle,
  onSeek,
  onRate,
}: {
  open: boolean
  track: PlayerTrack
  showName: string | null
  /** More than one episode can be played: previous / next make sense. */
  canSkip: boolean
  playing: boolean
  time: number
  duration: number
  rate: number
  failed: boolean
  /** Where Spotify's player is mounted. */
  host: RefObject<HTMLDivElement | null>
  /** Spotify's script could not load: show a plain embed. */
  embedFallback: boolean
  /** Playback was asked for but the browser did not start it. */
  embedBlocked: boolean
  onClose: () => void
  onStep: (direction: 1 | -1) => void
  onSkip: (seconds: number) => void
  onToggle: () => void
  onSeek: (seconds: number) => void
  onRate: () => void
}) {
  const spotify = track.kind === 'spotify' && Boolean(track.src)
  const fill = duration > 0 ? `${Math.min(100, (time / duration) * 100)}%` : '0%'
  const byline = [showName, track.subtitle].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  )
  const prevNext = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => onStep(direction)}
      aria-label={direction === 1 ? 'Next episode' : 'Previous episode'}
      disabled={!canSkip}
      className={ICON_BTN}
    >
      {direction === 1 ? (
        <SkipForward className="size-[1.1rem] fill-current" aria-hidden="true" />
      ) : (
        <SkipBack className="size-[1.1rem] fill-current" aria-hidden="true" />
      )}
    </button>
  )
  const close = (
    <button type="button" onClick={onClose} aria-label="Close the player" className={ICON_BTN}>
      <X className="size-5" aria-hidden="true" />
    </button>
  )
  return (
    <div
      hidden={!open}
      className="mt-3 rounded-2xl bg-black/35 p-3 ring-1 ring-white/10 backdrop-blur-sm sm:p-3.5"
    >
      {spotify ? (
        <div className="mb-2 flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate ps-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/60">
            Now playing
          </span>
          {prevNext(-1)}
          {prevNext(1)}
          {close}
        </div>
      ) : (
        <div className="mb-2 flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-[#1b3a86]">
            {track.cover}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{track.title}</p>
            <p className="truncate text-xs text-white/60">{byline.join(' · ')}</p>
          </div>
          {close}
        </div>
      )}

      {/* Spotify's own player is put in here by the iFrame API; it stays mounted while hidden. */}
      <div
        ref={host}
        className={spotify && !embedFallback ? 'overflow-hidden rounded-xl' : 'hidden'}
      />
      {spotify && track.src && embedFallback ? (
        <>
          <iframe
            key={track.id}
            src={track.src}
            title={track.title}
            allow="encrypted-media; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups"
            className={`w-full rounded-xl border-0 ${track.tallEmbed ? 'h-[352px]' : 'h-[152px]'}`}
          />
          <p className="mt-2 text-center text-xs text-white/55">Press play in the player above</p>
        </>
      ) : null}
      {spotify && !embedFallback && embedBlocked ? (
        <p role="status" className="mt-2 text-center text-xs text-white/65">
          It has not started yet: press play in the player above.
        </p>
      ) : null}

      {!spotify ? (
        <>
          <div className="flex items-center gap-3">
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
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span className="w-11 shrink-0 text-end text-xs tabular-nums text-white/75">
              {duration ? clock(duration) : (track.duration ?? '--:--')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <button
                type="button"
                onClick={onRate}
                aria-label={`Playback speed ${rate}×. Change speed`}
                className={`${CONTROL} h-8 min-w-11 border border-white/30 px-3 text-xs font-bold`}
              >
                {rate}×
              </button>
            </div>
            <div className="flex items-center gap-1 sm:gap-2.5">
              {prevNext(-1)}
              <button
                type="button"
                onClick={() => onSkip(-10)}
                aria-label="Back 10 seconds"
                className={`${CONTROL} h-9 px-1.5 text-xs font-semibold`}
              >
                −10s
              </button>
              <button
                type="button"
                onClick={onToggle}
                aria-label={playing ? 'Pause' : 'Play'}
                className="inline-flex size-12 items-center justify-center rounded-full text-[#0b0b0b] shadow-lg transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ backgroundColor: SPOTIFY_GREEN }}
              >
                {playing ? (
                  <Pause className="size-5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="ms-0.5 size-5 fill-current" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSkip(30)}
                aria-label="Forward 30 seconds"
                className={`${CONTROL} h-9 px-1.5 text-xs font-semibold`}
              >
                +30s
              </button>
              {prevNext(1)}
            </div>
            <div />
          </div>
          {failed ? (
            <p role="alert" className="mt-2 text-xs text-amber-300">
              This audio could not be loaded.{' '}
              {track.href ? (
                <Link href={track.href} className="underline">
                  Open the article
                </Link>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
