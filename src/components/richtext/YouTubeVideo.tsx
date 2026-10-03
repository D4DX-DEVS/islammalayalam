import type { ReactNode } from 'react'
import { ExternalLink, VideoOff } from 'lucide-react'
import { youtubeId } from '@/lib/security/url'
import { youtubeStatus } from '@/lib/youtube'

interface YouTubeVideoProps {
  url: string
  caption?: string | null
  /** Shown behind the notice when YouTube no longer plays the video (the post's featured image). */
  poster?: ReactNode
}

function Player({ id, title }: { id: string; title: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-card bg-black shadow-card">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        className="absolute inset-0 size-full"
      />
    </div>
  )
}

function Unavailable({ id, external, poster }: { id: string; external: boolean; poster?: ReactNode }) {
  return (
    <div
      className="relative isolate flex aspect-video flex-col items-center justify-center gap-4 overflow-hidden rounded-card bg-gradient-to-br from-[#0f3d7a] to-[#06142b] px-6 text-center text-white shadow-card"
      data-video-status={external ? 'external' : 'gone'}
    >
      {poster ?? <div className="bg-star-lattice absolute inset-0 opacity-[0.14]" />}
      {poster ? <div className="absolute inset-0 bg-black/65" /> : null}
      <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
        <VideoOff className="size-6" aria-hidden="true" />
      </span>
      <p className="relative max-w-md text-base font-semibold leading-relaxed sm:text-lg">
        {external ? 'ഈ വീഡിയോ YouTube-ൽ മാത്രമേ കാണാനാകൂ' : 'ഈ വീഡിയോ ഇപ്പോൾ YouTube-ൽ ലഭ്യമല്ല'}
      </p>
      {external ? (
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-brand-soft"
        >
          YouTube-ൽ കാണുക
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  )
}

/**
 * A YouTube video (privacy-enhanced youtube-nocookie player). YouTube is asked first whether the
 * video still plays (src/lib/youtube.ts): a removed video gets our own notice, not YouTube's error.
 */
export async function YouTubeVideo({ url, caption, poster }: YouTubeVideoProps) {
  const id = youtubeId(url)
  if (!id) return null
  const status = await youtubeStatus(id)
  return (
    <figure>
      {status === 'ok' || status === 'unknown' ? (
        <Player id={id} title={caption || 'YouTube video'} />
      ) : (
        <Unavailable id={id} external={status === 'external'} poster={poster} />
      )}
      {caption ? <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  )
}
