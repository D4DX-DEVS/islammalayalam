import { MessageCircle, Send } from 'lucide-react'
import type { SiteSetting } from '@/payload-types'

/**
 * Brand marks are not part of lucide-react 1.x, so the four logos are minimal inline SVGs
 * (Simple Icons geometry, CC0). WhatsApp/Telegram use generic lucide icons.
 */
const PATHS: Record<'facebook' | 'x' | 'youtube', string> = {
  facebook:
    'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
}
const LABELS = {
  facebook: 'Facebook',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
} as const
export type Network = keyof typeof LABELS

/** Brand mark for one network (also used by the article share buttons). */
export function SocialIcon({ network, className }: { network: Network; className: string }) {
  if (network === 'whatsapp') return <MessageCircle className={className} aria-hidden="true" />
  if (network === 'telegram') return <Send className={className} aria-hidden="true" />
  if (network === 'instagram') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={className}
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={PATHS[network]} />
    </svg>
  )
}

interface SocialLinksProps {
  social: SiteSetting['social']
  size?: 'sm' | 'md'
  /** plain = bare icons · solid = round buttons on light panels · glass = round buttons on the navy footer */
  variant?: 'plain' | 'solid' | 'glass'
  className?: string
}

const VARIANT = {
  plain: 'size-11 opacity-90 hover:opacity-100 hover:text-brand sm:size-9',
  solid: 'size-11 rounded-full bg-card text-brand shadow-card hover:bg-brand hover:text-white',
  glass: 'size-11 rounded-full bg-white/10 text-white hover:bg-white hover:text-brand-deep',
} as const

export function SocialLinks({
  social,
  size = 'sm',
  variant = 'plain',
  className = '',
}: SocialLinksProps) {
  const entries = (Object.keys(LABELS) as Network[]).filter((k) => social?.[k])
  if (!entries.length) return null
  const icon = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <ul className={`flex items-center ${variant === 'plain' ? 'gap-0.5' : 'gap-2'} ${className}`}>
      {entries.map((k) => (
        <li key={k}>
          <a
            href={social![k]!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABELS[k]}
            className={`inline-flex items-center justify-center transition-colors ${VARIANT[variant]}`}
          >
            <SocialIcon network={k} className={icon} />
          </a>
        </li>
      ))}
    </ul>
  )
}
