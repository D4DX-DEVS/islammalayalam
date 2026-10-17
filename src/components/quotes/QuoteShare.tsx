'use client'

import { useState, useSyncExternalStore } from 'react'
import { Check, Copy, Download, Mail, Share2 } from 'lucide-react'
import { SocialIcon, type Network } from '@/components/layout/SocialLinks'

/**
 * Share a quote in ONE row of labelled round buttons, each in its network's colour (plain links, no
 * third-party scripts): WhatsApp, Facebook, X, Telegram, Email and copy-link. Beside them, where it
 * helps: the device's own share sheet on phones and tablets (it also reaches Instagram, LinkedIn,
 * Snapchat… and can attach the poster), and — on the quote's own page — a poster download.
 */
interface QuoteShareProps {
  /** Absolute address of what is shared (link previews are built from it). */
  url: string
  /** The quote and its source, or a short line about the site; may be empty. */
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

export function QuoteShare({
  url,
  text,
  posterSrc,
  heading = 'Share this',
  compact = false,
  className = '',
}: QuoteShareProps) {
  const [copied, setCopied] = useState(false)
  // Server and first client render say "no", so hydration always matches; phones then switch on.
  const native = useSyncExternalStore(subscribe, supportsNativeShare, () => false)
  const enc = encodeURIComponent
  const lead = text || 'Insights — Islam Malayalam'

  const hrefs: Record<(typeof NETWORKS)[number]['key'], string> = {
    whatsapp: `https://wa.me/?text=${enc(`${lead}\n${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(lead)}`,
    x: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(lead)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(lead)}`,
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

  const shareNative = async () => {
    try {
      let data: ShareData = { title: 'Insights', text: lead, url }
      if (posterSrc) {
        try {
          const blob = await (await fetch(posterSrc)).blob()
          const file = new File([blob], `daily-quote.${blob.type.split('/')[1] || 'jpg'}`, {
            type: blob.type,
          })
          // Apps that take a picture often drop the link, so it travels in the text instead.
          if (navigator.canShare?.({ files: [file] }))
            data = { files: [file], text: `${lead}\n${url}` }
        } catch {
          // The image could not be fetched (another origin): share the link alone.
        }
      }
      await navigator.share(data)
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
          href={`mailto:?subject=${enc('Insights — Islam Malayalam')}&body=${enc(`${lead}\n\n${url}`)}`}
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
        {native ? (
          <button
            type="button"
            onClick={shareNative}
            aria-label="More ways to share"
            className={`${TILE} ${compact ? 'hidden [@media(pointer:coarse)]:flex' : ''}`}
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
          <a
            href={posterSrc}
            download
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download poster"
            className={TILE}
          >
            <span className={`${DISC} bg-brand-strong`}>
              <Download className="size-[1.15rem]" aria-hidden="true" />
            </span>
            <span data-share-label className="max-w-full">
              Poster
            </span>
          </a>
        ) : null}
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  )
}
