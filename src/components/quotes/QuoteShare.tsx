'use client'

import { useEffect, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { Check, Copy, Download, Mail, Share2 } from 'lucide-react'
import { SocialIcon, type Network } from '@/components/layout/SocialLinks'
import {
  canShareImages,
  pasteKeys,
  posterPicture,
  save,
  sendPoster,
  siteAddress,
  type PosterNetwork,
} from '@/lib/poster-share'
import { shareLinks } from '@/lib/share-links'

/**
 * Share a quote in ONE row of labelled round buttons, each in its network's colour (plain links, no
 * third-party scripts): WhatsApp, Facebook, X, Telegram, Email and copy-link. Beside them, where it
 * helps: the device's own share sheet on phones and tablets (it also reaches Instagram, LinkedIn,
 * Snapchat… and can attach the poster), and — on the quote's own page — a poster download.
 *
 * A poster is shared as an image file: the poster with "islammalayalam.net" on a strip under it
 * (lib/poster-share.ts). Wherever the browser can share files (phones, and Chrome / Edge / Safari
 * on a computer) the buttons open the device's share sheet and the app chosen receives the image,
 * with the website address as its caption; otherwise the picture is copied (or saved) and the
 * network's share page opens with the address already in the message, because no network takes an
 * image through a link. An insight with no poster shares its words and address as links.
 */
interface QuoteShareProps {
  /** Absolute address of what is shared (link previews are built from it). */
  url: string
  /** The quote and its source, or a short line about the site: shared only when there is no poster. */
  text: string
  /** Poster image address, when there is one to attach or download. */
  posterSrc?: string | null
  /** Heading of the box. */
  heading?: string
  /** The narrow sidebar card: six buttons (plus the device share sheet on touch screens). */
  compact?: boolean
  className?: string
}

const NETWORKS: Array<{
  key: Network & ('whatsapp' | 'facebook' | 'x' | 'telegram')
  label: string
  color: string
}> = [
  { key: 'whatsapp', label: 'WhatsApp', color: '#25d366' },
  { key: 'facebook', label: 'Facebook', color: '#1877f2' },
  { key: 'x', label: 'X', color: '#0f1419' },
  { key: 'telegram', label: 'Telegram', color: '#229ed9' },
]

const TILE =
  'group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl py-1 text-center text-[0.6rem] font-medium leading-tight tracking-tight text-body transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
const DISC =
  'inline-flex size-10 items-center justify-center rounded-full text-white ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:shadow-lift'

const subscribe = () => () => {}
const supportsNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const supportsImageShare = () => canShareImages()

export function QuoteShare({
  url,
  text,
  posterSrc,
  heading = 'Share this',
  compact = false,
  className = '',
}: QuoteShareProps) {
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Server and first client render say "no", so hydration always matches; phones then switch on.
  const native = useSyncExternalStore(subscribe, supportsNativeShare, () => false)
  const imageShare = useSyncExternalStore(subscribe, supportsImageShare, () => false)
  const enc = encodeURIComponent
  // With a poster the picture is the message; without one the words are.
  const words = posterSrc ? '' : text
  const body = [words, url].filter(Boolean).join('\n')
  const subject = 'Insights — Islam Malayalam'

  const hrefs = shareLinks(url, words)
  // A poster travels as a picture; the only text with it is the website address ("islammalayalam.net").
  const address = siteAddress(url)
  const site = `https://${address}`
  const pasteHrefs = shareLinks(site)

  // Make the picture while the visitor is still looking, so pressing a button hands it over at once.
  useEffect(() => {
    if (posterSrc) posterPicture(posterSrc, address).catch(() => {})
  }, [posterSrc, address])
  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), 9000)
    return () => window.clearTimeout(timer)
  }, [note])

  /** A network button with a poster: send the picture. Without one (or on a modified click) it is the link. */
  const sharePicture =
    (to: PosterNetwork, label: string) => async (event: MouseEvent<HTMLAnchorElement>) => {
      if (!posterSrc || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
        return
      event.preventDefault()
      if (busy) return
      setBusy(true)
      try {
        const outcome = await sendPoster(await posterPicture(posterSrc, address), to, {
          caption: site,
          href: pasteHrefs[to],
        })
        if (outcome === 'copied')
          setNote(
            `Poster copied. Paste it into ${label} (${pasteKeys(navigator.userAgent)}): the address is already in the message.`,
          )
        if (outcome === 'saved')
          setNote(`Poster saved to your downloads. Attach it to your ${label} message.`)
      } catch {
        // No picture could be made (the poster is unreachable): share the link instead.
        window.open(hrefs[to], '_blank', 'noopener,noreferrer')
      } finally {
        setBusy(false)
      }
    }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (permissions / insecure context): the address bar still has the link.
    }
  }

  /** The poster page's download: the picture that is shared (poster + address), not the bare poster. */
  const download = async () => {
    if (!posterSrc) return
    try {
      save((await posterPicture(posterSrc, address)).jpeg)
    } catch {
      window.open(posterSrc, '_blank', 'noopener,noreferrer')
    }
  }

  const shareNative = async () => {
    try {
      if (posterSrc) {
        try {
          await sendPoster(await posterPicture(posterSrc, address), 'device', { caption: site })
          return
        } catch {
          // No picture could be made: share the link alone.
        }
      }
      await navigator.share({ title: 'Insights', url, ...(words ? { text: words } : {}) })
    } catch {
      // Closed without sharing, or not allowed: nothing to report.
    }
  }

  return (
    <div className={className}>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <h3 className="text-center text-sm font-normal text-body">{heading}</h3>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <div className={`flex items-start justify-between gap-0.5 ${compact ? '-mx-1.5' : ''}`}>
        {NETWORKS.map(({ key, label, color }) => (
          <a
            key={key}
            href={hrefs[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${label}`}
            onClick={sharePicture(key, label)}
            className={TILE}
          >
            <span className={DISC} style={{ backgroundColor: color }}>
              <SocialIcon network={key} className="size-[1.15rem]" />
            </span>
            <span data-share-label className="max-w-full">
              {label}
            </span>
          </a>
        ))}
        <a
          href={`mailto:?subject=${enc(subject)}&body=${enc(body)}`}
          aria-label="Share by email"
          className={TILE}
        >
          <span className={DISC} style={{ backgroundColor: '#ea4335' }}>
            <Mail className="size-[1.15rem]" aria-hidden="true" />
          </span>
          <span data-share-label className="max-w-full">
            Email
          </span>
        </a>
        <button type="button" onClick={copy} aria-label="Copy link" className={TILE}>
          <span className={`${DISC} bg-slate-500`}>
            {copied ? (
              <Check className="size-[1.15rem]" aria-hidden="true" />
            ) : (
              <Copy className="size-[1.15rem]" aria-hidden="true" />
            )}
          </span>
          <span data-share-label className="max-w-full">
            {copied ? 'Copied!' : 'Copy Link'}
          </span>
        </button>
        {native && !(posterSrc && imageShare) ? (
          <button
            type="button"
            onClick={shareNative}
            aria-label="More ways to share"
            className={TILE}
          >
            <span className={`${DISC} bg-brand`}>
              <Share2 className="size-[1.15rem]" aria-hidden="true" />
            </span>
            <span data-share-label className="max-w-full">
              More
            </span>
          </button>
        ) : null}
        {posterSrc && !compact ? (
          <button type="button" onClick={download} aria-label="Download poster" className={TILE}>
            <span className={`${DISC} bg-brand-strong`}>
              <Download className="size-[1.15rem]" aria-hidden="true" />
            </span>
            <span data-share-label className="max-w-full">
              Poster
            </span>
          </button>
        ) : null}
      </div>
      {note ? (
        <p className="mt-2.5 rounded-lg bg-brand/10 px-3 py-2 text-center text-xs font-medium leading-snug text-brand-strong">
          {note}
        </p>
      ) : null}
      <span role="status" className="sr-only">
        {note ?? (copied ? 'Link copied' : '')}
      </span>
    </div>
  )
}
