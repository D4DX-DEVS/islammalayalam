import type { SiteSetting } from '@/payload-types'

/**
 * Social network icons: modern 2px line icons on a 24px grid, the same weight as the lucide icons
 * used everywhere else on the site. lucide 1.x has no brand marks, so these seven are the brand
 * outlines of Tabler Icons (MIT), drawn inline: no extra package, no extra request.
 *
 * Tabler Icons — MIT License — Copyright (c) 2020-2026 Paweł Kuna — https://tabler.io/icons
 */
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

const SHAPES: Record<Network, string[]> = {
  facebook: ['M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3'],
  x: ['M4 4l11.733 16h4.267l-11.733 -16l-4.267 0', 'M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772'],
  instagram: [
    'M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10',
    'M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 0 0 -7 0',
    'M17 7v.01',
  ],
  youtube: [
    'M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8',
    'M10 9l5 3l-5 3l0 -6',
  ],
  whatsapp: [
    'M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9',
    'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1',
  ],
  telegram: ['M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4'],
  spotify: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M8 11.973c2.5 -1.473 5.5 -.973 7.5 .527',
    'M9 15c1.5 -1 4 -1 5 .5',
    'M7 9c2 -1 6 -2 10 .5',
  ],
}

/** Icon for one network (also used by the share buttons, the audio player and the WhatsApp button). */
export function SocialIcon({ network, className }: { network: Network; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {SHAPES[network].map((d) => (
        <path key={d} d={d} />
      ))}
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
  const icon = size === 'sm' ? 'size-[1.1rem]' : 'size-5'
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
