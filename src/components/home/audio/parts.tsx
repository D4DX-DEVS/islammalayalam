import type { ReactNode } from 'react'
import { SocialIcon } from '@/components/layout/SocialLinks'

/** Shared types and small pieces of the Audios player (components/home/AudioPlayer.tsx). */
export interface PlayerTrack {
  id: string
  title: string
  subtitle: string | null
  /** The post page; null for a quick entry or a Spotify episode, which have none. */
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
  /** The episode's blurb (a Spotify episode's description). */
  description: string | null
  /** Length in words ("3 min"), shown beside the date. */
  length: string | null
  /** Cover URL for the lock screen / media keys. */
  art: string | null
  /** Server-rendered square artwork (placeholder and lazy loading included). */
  cover: ReactNode
  /** This episode on Spotify (feeds the Spotify buttons), if there is one. */
  spotifyLink: string | null
}

/** The Spotify show the episodes belong to (named under the episode that is playing). */
export type PlayerShow = {
  name: string
  url: string
}

export const SPOTIFY_GREEN = 'var(--color-brand)'

export const isPlayable = (t: PlayerTrack | undefined): boolean =>
  t?.kind === 'file' || t?.kind === 'spotify'

/** Spotify's icon (drawn in Spotify's green where it names a Spotify action). */
export function SpotifyMark({ className }: { className: string }) {
  return <SocialIcon network="spotify" className={className} />
}

export const CONTROL =
  'inline-flex items-center justify-center rounded-full text-muted transition hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
export const ICON_BTN = `${CONTROL} size-9`

export function Equalizer() {
  return (
    <span className="inline-flex h-3.5 items-end justify-center gap-0.5" aria-hidden="true">
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
