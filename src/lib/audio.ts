import { spotifyEmbedUrl, spotifyOpenUrl } from '@/lib/security/url'
import { cdnUrl } from '@/lib/spaces'

/**
 * How a post's audio link can be played. The CSP only allows media from this site and the media CDN,
 * so a plain audio file plays inline only when it lives there; Spotify links use Spotify's embed;
 * anything else is just a link and is listened to on its own page.
 */
export type AudioSource =
  | { kind: 'spotify'; src: string; tall: boolean }
  | { kind: 'file'; src: string }
  | { kind: 'link'; src: string }
  | { kind: 'none' }

const AUDIO_FILE = /\.(mp3|m4a|ogg|wav)(\?.*)?$/i

export function audioSource(url: string | null | undefined): AudioSource {
  const raw = url?.trim()
  if (!raw) return { kind: 'none' }
  const spotify = spotifyEmbedUrl(raw)
  if (spotify)
    return { kind: 'spotify', src: spotify, tall: /\/(show|playlist|album)\//.test(spotify) }
  const cdn = cdnUrl(process.env.DO_SPACES_CDN_ENDPOINT)
  if (AUDIO_FILE.test(raw) && (raw.startsWith('/') || (cdn && raw.startsWith(`${cdn}/`))))
    return { kind: 'file', src: raw }
  return { kind: 'link', src: raw }
}

export type TrackAudio = {
  source: AudioSource
  /** Address for the player's Spotify button (episode / show on Spotify), when there is one. */
  spotifyLink: string | null
}

/**
 * What a post's audio fields give the player. Hosted audio plays right in the player; otherwise a
 * Spotify link (the dedicated Spotify field, or Spotify typed into the audio link) plays in
 * Spotify's embed. Either way a Spotify link, if there is one, also feeds the Spotify button.
 */
export function trackAudio(
  audio: { url?: string | null; spotifyUrl?: string | null } | null | undefined,
): TrackAudio {
  const link = audioSource(audio?.url)
  const spotifyLink =
    spotifyOpenUrl(audio?.spotifyUrl) ??
    (link.kind === 'spotify' ? spotifyOpenUrl(audio?.url) : null)
  if (link.kind === 'file' || link.kind === 'spotify') return { source: link, spotifyLink }
  const embed = spotifyEmbedUrl(audio?.spotifyUrl ?? '')
  if (embed)
    return {
      source: { kind: 'spotify', src: embed, tall: /\/(show|playlist|album)\//.test(embed) },
      spotifyLink,
    }
  return { source: link, spotifyLink }
}
