'use client'

import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { SocialIcon, type Network } from '@/components/layout/SocialLinks'

interface ShareButtonsProps {
  url: string
  title: string
  className?: string
}

const BUTTON =
  'inline-flex size-10 items-center justify-center rounded-full border border-line text-body transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand'

/** Plain share links (no third-party scripts or trackers) + copy-link. */
export function ShareButtons({ url, title, className = '' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const enc = encodeURIComponent
  const targets: Array<{ network: Network; label: string; href: string }> = [
    {
      network: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
    },
    {
      network: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      network: 'x',
      label: 'X',
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
    },
  ]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (permissions/insecure context): nothing to do, the URL bar still works.
    }
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="me-1 text-xs font-semibold text-muted">പങ്കിടുക</span>
      {targets.map((t) => (
        <a
          key={t.network}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.label} വഴി പങ്കിടുക`}
          className={BUTTON}
        >
          <SocialIcon network={t.network} className="size-4" />
        </a>
      ))}
      <button type="button" onClick={copy} aria-label="ലിങ്ക് പകർത്തുക" className={BUTTON}>
        {copied ? (
          <Check className="size-4 text-brand" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'ലിങ്ക് പകർത്തി' : ''}
      </span>
    </div>
  )
}
