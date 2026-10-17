'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Eye, Play, Smartphone } from 'lucide-react'
import { ShortsLightbox } from '@/components/home/ShortsLightbox'
import { ScrollRow } from '@/components/ui/ScrollRow'
import type { Short } from '@/lib/youtube-shorts'

/** One Short: a vertical poster that lifts on hover, with its title, speaker and views underneath. */
function ShortCard({ short, onOpen }: { short: Short; onOpen: () => void }) {
  // A Short without a poster of its own falls back to the first frame of the video.
  const [thumb, setThumb] = useState(short.thumb)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Play Short: ${short.title}`}
      className="group block w-full cursor-pointer text-start outline-offset-4"
    >
      <span className="shine relative block aspect-[9/16] overflow-hidden rounded-2xl bg-brand-deep shadow-card ring-1 ring-black/5 transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-lift group-focus-visible:-translate-y-1.5 motion-reduce:transform-none">
        <Image
          src={thumb}
          alt=""
          fill
          sizes="(min-width: 1024px) 15rem, (min-width: 640px) 30vw, 46vw"
          onError={() => setThumb(`https://i.ytimg.com/vi/${short.id}/frame0.jpg`)}
          className="object-cover transition duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
        />
        <span
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent"
          aria-hidden="true"
        />
        <span className="absolute start-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-white backdrop-blur-sm">
          <Smartphone className="size-3 text-[#ff5a66]" aria-hidden="true" />
          Shorts
        </span>
        <span className="absolute bottom-3 end-3 inline-flex size-11 items-center justify-center rounded-full bg-white/95 text-[#e11d2e] shadow-lift transition duration-300 group-hover:scale-110">
          <Play className="ms-0.5 size-5 fill-current" aria-hidden="true" />
        </span>
      </span>
      <span className="mt-3 block space-y-1 px-0.5">
        <span className="line-clamp-2 text-[0.92rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
          {short.title}
        </span>
        {short.subtitle ? (
          <span className="block truncate text-xs text-body">{short.subtitle}</span>
        ) : null}
        {short.views ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Eye className="size-3.5" aria-hidden="true" />
            {short.views}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/** The row of Shorts (5 across on a desktop, swipeable on a phone) and the popup player they open. */
export function ShortsCarousel({ shorts, label }: { shorts: Short[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <ScrollRow
        tone="light"
        arrows="overlay"
        label={label}
        listClassName="-mx-4 px-4 pb-3 pt-2 sm:mx-0 sm:px-0"
      >
        {shorts.map((short, i) => (
          <li
            key={short.id}
            data-reveal="up"
            suppressHydrationWarning
            className="w-[46%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
          >
            <ShortCard short={short} onOpen={() => setOpen(i)} />
          </li>
        ))}
      </ScrollRow>
      {open !== null ? (
        <ShortsLightbox
          shorts={shorts}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}
