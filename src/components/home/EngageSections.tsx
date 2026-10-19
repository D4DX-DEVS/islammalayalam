import Image from 'next/image'
import { ChevronDown, CircleHelp, Clapperboard, Quote } from 'lucide-react'
import { PANEL } from '@/components/home/CategorySections'
import { ReelPlayer } from '@/components/home/ReelPlayer'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SmartLink } from '@/components/ui/SmartLink'
import { resolveLink } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import { quoteIndexForDate } from '@/lib/quote'
import { youtubeId } from '@/lib/security/url'
import type {
  CallToActionBlock,
  FaqBlock,
  Media,
  QuoteOfDayBlock,
  ReelsBlock,
} from '@/payload-types'

/** Client revamp sections: quote of the day, reels, FAQ, call-to-action cards. */

const asMedia = (value: unknown): Media | null =>
  value && typeof value === 'object' ? (value as Media) : null

export function QuoteOfDaySection({ block }: { block: QuoteOfDayBlock }) {
  const quotes = block.quotes ?? []
  const quote = quotes[quoteIndexForDate(quotes.length)]
  if (!quote) return null
  const flyer = asMedia(quote.flyer)
  const src = mediaSrc(flyer?.sizes?.large?.url ?? flyer?.url)
  return (
    <section className="bg-night relative isolate overflow-hidden rounded-panel p-6 text-white shadow-card ring-1 ring-white/10 sm:p-8">
      <SectionHeading title={block.title || 'ഇന്നത്തെ ചിന്ത'} tone="dark" icon={Quote} />
      {src && flyer?.width && flyer.height ? (
        <Image
          src={src}
          alt={quote.text || flyer.alt || block.title || 'ഇന്നത്തെ ചിന്ത'}
          width={flyer.width}
          height={flyer.height}
          sizes="(min-width: 1024px) 21rem, 100vw"
          className="mb-4 h-auto w-full rounded-2xl"
        />
      ) : null}
      {quote.text ? (
        <figure>
          <Quote className="mb-3 size-9 text-accent" aria-hidden="true" />
          <blockquote className="whitespace-pre-line text-lg font-semibold leading-relaxed sm:text-xl">
            {quote.text}
          </blockquote>
          {quote.source ? (
            <figcaption className="mt-4 text-sm font-medium text-sky-200">
              — {quote.source}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </section>
  )
}

export function ReelsSection({ block, compact }: { block: ReelsBlock; compact: boolean }) {
  const reels = (block.videos ?? []).flatMap((v) => {
    const id = youtubeId(v.url)
    return id ? [{ id, title: v.title, key: v.id ?? id }] : []
  })
  if (!reels.length) return null
  const more = resolveLink(block.moreLink)
  return (
    <section className={compact ? PANEL : ''}>
      <SectionHeading title={block.title || 'സംശയനിവാരണം'} href={more?.href} icon={Clapperboard} />
      <ul
        className={
          compact
            ? 'grid grid-cols-2 gap-3'
            : 'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5'
        }
      >
        {reels.map((r) => (
          <li key={r.key} className={compact ? '' : 'w-[45%] shrink-0 snap-start sm:w-auto'}>
            <ReelPlayer id={r.id} title={r.title} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FaqSection({ block }: { block: FaqBlock }) {
  const items = block.items ?? []
  if (!items.length) return null
  const more = resolveLink(block.moreLink)
  return (
    <section className={PANEL}>
      <SectionHeading
        title={block.title || 'പൊതുവായ ചോദ്യങ്ങള്‍'}
        href={more?.href}
        icon={CircleHelp}
      />
      <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
        {items.map((item, i) => (
          <details key={item.id ?? i} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold text-ink transition-colors hover:text-brand sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="leading-snug">{item.question}</span>
              <ChevronDown
                className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="whitespace-pre-line px-4 pb-5 leading-relaxed text-body sm:px-5">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

const TONE = {
  brand: {
    box: 'bg-brand-gradient text-white',
    eyebrow: 'text-sky-100',
    chip: 'bg-white/12 ring-1 ring-white/20',
    primary: 'bg-white text-brand hover:bg-brand-soft',
    secondary: 'ring-1 ring-white/50 text-white hover:bg-white/10',
  },
  gold: {
    box: 'bg-accent-strong text-on-accent',
    eyebrow: 'opacity-80',
    chip: 'bg-black/10 ring-1 ring-black/10',
    primary: 'bg-brand-deep text-white hover:opacity-90',
    secondary: 'ring-1 ring-current hover:bg-black/5',
  },
  navy: {
    box: 'bg-night text-white',
    eyebrow: 'text-sky-300',
    chip: 'bg-white/10 ring-1 ring-white/15',
    primary: 'bg-accent-strong text-on-accent hover:opacity-90',
    secondary: 'ring-1 ring-white/40 text-white hover:bg-white/10',
  },
  light: {
    box: 'bg-surface text-ink',
    eyebrow: 'text-accent-strong',
    chip: 'bg-card ring-1 ring-line',
    primary: 'bg-brand-gradient text-white hover:opacity-90',
    secondary: 'ring-1 ring-line text-ink hover:bg-card',
  },
} as const

export function CallToActionSection({
  block,
  compact,
}: {
  block: CallToActionBlock
  compact: boolean
}) {
  const tone = TONE[block.tone ?? 'brand'] ?? TONE.brand
  const image = asMedia(block.image)
  const src = mediaSrc(image?.sizes?.large?.url ?? image?.url)
  const hasImage = Boolean(src && image?.width && image.height)
  const buttons = (block.buttons ?? []).flatMap((b) => {
    const link = resolveLink(b.link)
    return link?.href ? [{ ...link, style: b.style ?? 'primary', key: b.id ?? link.href }] : []
  })
  const details = block.details ?? []
  return (
    <section
      className={`relative isolate overflow-hidden rounded-panel shadow-card ${tone.box} ${
        hasImage && !compact ? 'grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : ''
      }`}
    >
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
        {block.eyebrow ? (
          <p className={`text-xs font-bold uppercase tracking-wider ${tone.eyebrow}`}>
            {block.eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold leading-snug text-inherit sm:text-3xl">
          {block.heading}
        </h2>
        {block.text ? (
          <p className="whitespace-pre-line leading-relaxed opacity-90">{block.text}</p>
        ) : null}
        {details.length ? (
          <dl className="flex flex-wrap gap-2">
            {details.map((d, i) => (
              <div key={d.id ?? i} className={`rounded-xl px-3 py-2 text-sm ${tone.chip}`}>
                <dt className="text-xs opacity-75">{d.label}</dt>
                <dd className="font-semibold">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {buttons.length ? (
          <div className="flex flex-wrap gap-3 pt-1">
            {buttons.map((b) => (
              <SmartLink
                key={b.key}
                href={b.href}
                external={b.external}
                newTab={b.newTab}
                className={`inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold transition hover:-translate-y-px ${
                  b.style === 'secondary' ? tone.secondary : tone.primary
                }`}
              >
                {b.label}
              </SmartLink>
            ))}
          </div>
        ) : null}
      </div>
      {hasImage && src && image ? (
        <div className={`relative ${compact ? 'aspect-[16/9]' : 'min-h-56 md:min-h-full'}`}>
          <Image
            src={src}
            alt={image.alt ?? ''}
            fill
            sizes={compact ? '21rem' : '(min-width: 768px) 40vw, 100vw'}
            className="object-cover"
          />
        </div>
      ) : null}
    </section>
  )
}
