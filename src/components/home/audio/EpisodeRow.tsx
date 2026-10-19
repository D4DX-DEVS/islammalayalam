import Link from 'next/link'
import {
  Download,
  EllipsisVertical,
  ExternalLink,
  Link2,
  Pause,
  Play,
  Plus,
  Share2,
} from 'lucide-react'
import { clock } from '@/lib/audio-list'
import { Equalizer, ICON_BTN, SPOTIFY_GREEN, SpotifyMark, type PlayerTrack } from './parts'

/**
 * One episode, as on a Spotify show page: its picture, title, blurb, date and length, then its
 * actions — ⋮ menu (copy link, open in Spotify / the article), Share, Download (hosted audio), Save
 * on Spotify — and the round Play button.
 */
export function EpisodeRow({
  track: t,
  active,
  playing,
  loadedSeconds,
  url,
  menuPos,
  onMenu,
  onMenuClose,
  onChoose,
  onShare,
  onCopy,
}: {
  track: PlayerTrack
  /** This is the episode in the play bar. */
  active: boolean
  /** Our own player is playing it (a Spotify embed reports nothing back). */
  playing: boolean
  /** Real length of the loaded file, once known. */
  loadedSeconds: number
  /** Where Share / Copy link point. */
  url: string | null
  /** Where the ⋮ menu floats (screen position), or null when it is closed. */
  menuPos: { top: number; left: number } | null
  onMenu: (button: DOMRect) => void
  onMenuClose: () => void
  onChoose: () => void
  onShare: () => void
  onCopy: () => void
}) {
  const unavailable = t.kind === 'none'
  const length = t.length ?? (active && loadedSeconds ? clock(loadedSeconds) : t.duration)
  const meta = [t.subtitle, length].filter(Boolean).join(' • ')
  const item = 'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start hover:bg-white/10'
  return (
    <li
      data-track={t.id}
      className="border-b border-white/10 last:border-b-0"
      aria-current={active ? 'true' : undefined}
    >
      <div className={`flex gap-3.5 py-3 sm:gap-4 ${unavailable ? 'opacity-60' : ''}`}>
        <button
          type="button"
          onClick={onChoose}
          disabled={unavailable}
          tabIndex={-1}
          aria-hidden="true"
          className="relative size-[4.5rem] shrink-0 self-start overflow-hidden rounded-md bg-[#1b3a86] sm:size-20"
        >
          {t.cover}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onChoose}
            disabled={unavailable}
            className="block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span
              className="line-clamp-2 text-base font-bold leading-snug text-white sm:text-[1.05rem]"
              style={active ? { color: SPOTIFY_GREEN } : undefined}
            >
              {t.title}
            </span>
          </button>
          {t.description ? (
            <p className="mt-0.5 line-clamp-1 text-sm leading-snug text-white/60">
              {t.description}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
            {playing ? <Equalizer /> : null}
            <span>
              {meta}
              {unavailable ? `${meta ? ' • ' : ''}Soon` : ''}
            </span>
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="-ms-2 flex items-center">
              <div className="relative" data-menu>
                <button
                  type="button"
                  aria-label={`More options for ${t.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menuPos !== null}
                  onClick={(e) => onMenu(e.currentTarget.getBoundingClientRect())}
                  className={ICON_BTN}
                >
                  <EllipsisVertical className="size-5" aria-hidden="true" />
                </button>
                {menuPos ? (
                  // Fixed, so the list's own scrolling cannot clip it.
                  <div
                    role="menu"
                    style={{ top: menuPos.top, left: menuPos.left }}
                    className="fixed z-50 w-52 rounded-lg bg-[#282828] p-1 text-sm shadow-[0_16px_40px_-8px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
                  >
                    {url ? (
                      <button type="button" role="menuitem" onClick={onCopy} className={item}>
                        <Link2 className="size-4" aria-hidden="true" />
                        Copy link
                      </button>
                    ) : null}
                    {t.spotifyLink ? (
                      <a
                        role="menuitem"
                        href={t.spotifyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onMenuClose}
                        className={item}
                      >
                        <SpotifyMark className="size-4" />
                        Open in Spotify
                      </a>
                    ) : null}
                    {t.href ? (
                      <Link role="menuitem" href={t.href} onClick={onMenuClose} className={item}>
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Open the article
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {url ? (
                <button
                  type="button"
                  onClick={onShare}
                  aria-label={`Share ${t.title}`}
                  title="Share"
                  className={ICON_BTN}
                >
                  <Share2 className="size-5" aria-hidden="true" />
                </button>
              ) : null}
              {t.kind === 'file' && t.src ? (
                <a
                  href={t.src}
                  download
                  aria-label={`Download ${t.title}`}
                  title="Download"
                  className={ICON_BTN}
                >
                  <Download className="size-5" aria-hidden="true" />
                </a>
              ) : null}
              {t.spotifyLink ? (
                <a
                  href={t.spotifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Save ${t.title} on Spotify`}
                  title="Save on Spotify"
                  className={ICON_BTN}
                >
                  <Plus className="size-5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onChoose}
              disabled={unavailable}
              aria-label={`${playing ? 'Pause' : t.kind === 'link' ? 'Open' : 'Play'} ${t.title}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0b0b] shadow-lg transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-40"
            >
              {playing ? (
                <Pause className="size-5 fill-current" aria-hidden="true" />
              ) : t.kind === 'link' ? (
                <ExternalLink className="size-5" aria-hidden="true" />
              ) : (
                <Play className="ms-0.5 size-5 fill-current" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
