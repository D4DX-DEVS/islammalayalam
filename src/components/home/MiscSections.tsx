import Image from 'next/image'
import { ArrowUpRight, FileText, Link2, Mail, Users } from 'lucide-react'
import { PANEL } from '@/components/home/CategorySections'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SmartLink } from '@/components/ui/SmartLink'
import { RichText } from '@/components/richtext/RichText'
import { ContactDetails } from '@/components/layout/ContactDetails'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { resolveLink } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import type {
  BannerBlock,
  QuickContactBlock,
  QuickLinksBlock,
  RichTextBlock,
  SiteSetting,
  FollowUsBlock,
} from '@/payload-types'

export function RichTextSection({ block }: { block: RichTextBlock }) {
  return (
    <section>
      {block.title ? <SectionHeading title={block.title} icon={FileText} /> : null}
      <RichText data={block.content} />
    </section>
  )
}

export function BannerSection({ block }: { block: BannerBlock }) {
  const media = block.image && typeof block.image === 'object' ? block.image : null
  const src = mediaSrc(media?.sizes?.large?.url ?? media?.url)
  if (!media || !src || !media.width || !media.height) return null
  const link = resolveLink(block.link)
  const img = (
    <span className="shine relative block overflow-hidden rounded-panel shadow-card">
      <Image
        src={src}
        alt={media.alt ?? ''}
        width={media.width}
        height={media.height}
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="h-auto w-full"
      />
    </span>
  )
  return (
    <section>
      {link?.href ? (
        <SmartLink
          href={link.href}
          external={link.external}
          newTab={link.newTab}
          className="block transition-opacity hover:opacity-95"
        >
          {img}
        </SmartLink>
      ) : (
        img
      )}
    </section>
  )
}

export function QuickLinksSection({ block }: { block: QuickLinksBlock }) {
  const links = (block.links ?? []).map((row) => resolveLink(row.link)).filter((l) => l !== null)
  if (!links.length) return null
  return (
    <section className={PANEL}>
      <SectionHeading title={block.title || 'Quick Links'} icon={Link2} />
      <ul className="space-y-1">
        {links.map((l, i) => (
          <li key={i}>
            <SmartLink
              href={l.href}
              external={l.external}
              newTab={l.newTab}
              className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-sm font-medium text-ink transition hover:bg-brand-soft hover:text-brand"
            >
              {l.label}
              {l.href ? (
                <ArrowUpRight
                  className="size-4 text-muted transition-colors group-hover:text-brand"
                  aria-hidden="true"
                />
              ) : null}
            </SmartLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FollowUsSection({
  block,
  settings,
}: {
  block: FollowUsBlock
  settings: SiteSetting
}) {
  return (
    <section className={PANEL}>
      <SectionHeading title={block.title || 'Follow Us'} icon={Users} />
      <SocialLinks social={settings.social} size="md" variant="solid" className="flex-wrap" />
    </section>
  )
}

/** Contact details from Site settings. (The contact form arrives with the rate-limited server action.) */
export function QuickContactSection({
  block,
  settings,
}: {
  block: QuickContactBlock
  settings: SiteSetting
}) {
  return (
    <section className={PANEL}>
      <SectionHeading title={block.title || 'Quick Contact'} icon={Mail} />
      {block.intro ? <p className="mb-4 text-sm">{block.intro}</p> : null}
      <ContactDetails contact={settings.contact} />
    </section>
  )
}
