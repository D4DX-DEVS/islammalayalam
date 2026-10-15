'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

/**
 * One vertical reel. Shows YouTube's thumbnail until tapped, then swaps in the privacy-mode player
 * (nothing from YouTube loads until the visitor asks for it).
 */
export function ReelPlayer({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  // Removed/private videos have no thumbnail: keep the plain navy tile instead of a broken image.
  const [thumbFailed, setThumbFailed] = useState(false)
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-brand-deep shadow-card ring-1 ring-black/5">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`പ്ലേ ചെയ്യുക: ${title}`}
          className="group absolute inset-0 size-full text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {thumbFailed ? (
            <span className="absolute inset-0 bg-brand-deep" aria-hidden="true" />
          ) : (
            <Image
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              fill
              sizes="(min-width: 1024px) 10rem, 45vw"
              onError={() => setThumbFailed(true)}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <span
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
            aria-hidden="true"
          />
          <span className="absolute start-1/2 top-1/2 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-deep shadow-card backdrop-blur transition-transform group-hover:scale-110 rtl:translate-x-1/2">
            <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
          </span>
          <span className="absolute inset-x-0 bottom-0 line-clamp-3 p-3 text-sm font-semibold leading-snug text-white">
            {title}
          </span>
        </button>
      )}
    </div>
  )
}
