import { Podcast, Send } from 'lucide-react'
import type { SiteSetting } from '@/payload-types'

/**
 * Brand marks are not part of lucide-react 1.x, so the four logos are minimal inline SVGs
 * (Simple Icons geometry, CC0). WhatsApp/Telegram/Spotify use generic lucide icons.
 */
const PATHS: Record<'facebook' | 'x' | 'youtube' | 'whatsapp', string> = {
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
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
  spotify: 'Spotify',
} as const
export type Network = keyof typeof LABELS

/** Brand mark for one network (also used by the article share buttons). */
export function SocialIcon({ network, className }: { network: Network; className: string }) {
  if (network === 'telegram') return <Send className={className} aria-hidden="true" />
  if (network === 'spotify') return <Podcast className={className} aria-hidden="true" />
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
  /**
   * plain = bare icons · brand = bare icons in each network's colour (header) · solid = round buttons
   * on light panels · glass = round buttons on the navy footer · fill = round buttons in each network's colour
   */
  variant?: 'plain' | 'brand' | 'solid' | 'glass' | 'fill'
  className?: string
}

/** Brand colours, as complete class names so Tailwind can see them. */
const BRAND_TEXT: Record<Network, string> = {
  facebook: 'text-[#1877f2]',
  x: 'text-ink',
  instagram: 'text-[#e1306c]',
  youtube: 'text-[#ff0000]',
  whatsapp: 'text-[#25d366]',
  telegram: 'text-[#229ed9]',
  spotify: 'text-[#1db954]',
}
const BRAND_FILL: Record<Network, string> = {
  facebook: 'bg-[#1877f2] text-white',
  x: 'bg-[#0f1419] text-white ring-1 ring-white/25',
  instagram: 'bg-gradient-to-tr from-[#f9a43b] via-[#e1306c] to-[#833ab4] text-white',
  youtube: 'bg-[#ff0000] text-white',
  whatsapp: 'bg-[#25d366] text-white',
  telegram: 'bg-[#229ed9] text-white',
  spotify: 'bg-[#1db954] text-white',
}

const VARIANT = {
  plain: 'size-11 opacity-90 hover:opacity-100 hover:text-brand sm:size-9',
  brand: 'size-11 hover:scale-125 sm:size-9',
  fill: 'size-11 rounded-full hover:-translate-y-0.5 hover:scale-110 hover:shadow-lift',
  solid:
    'size-11 rounded-full bg-card text-brand shadow-card ring-1 ring-line/60 hover:-translate-y-0.5 hover:bg-brand hover:text-white hover:ring-brand',
  glass:
    'size-11 rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:-translate-y-0.5 hover:bg-white hover:text-brand-deep',
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
    <ul
      className={`flex items-center ${variant === 'plain' || variant === 'brand' ? 'gap-0.5' : 'gap-2'} ${className}`}
    >
      {entries.map((k) => (
        <li key={k}>
          <a
            href={social![k]!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABELS[k]}
            className={`inline-flex items-center justify-center transition duration-300 ${VARIANT[variant]} ${variant === 'brand' ? BRAND_TEXT[k] : variant === 'fill' ? BRAND_FILL[k] : ''}`}
          >
            <SocialIcon network={k} className={icon} />
          </a>
        </li>
      ))}
    </ul>
  )
}
