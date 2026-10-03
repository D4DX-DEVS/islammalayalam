import { ArrowUp, Mail, MapPin, Phone } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { Brand } from '@/components/layout/Brand'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { resolveLink } from '@/lib/links'
import type { Footer as FooterData, SiteSetting } from '@/payload-types'

type Column = NonNullable<FooterData['columns']>[number]

function ColumnBody({ column, settings }: { column: Column; settings: SiteSetting }) {
  if (column.kind === 'links') {
    return (
      <ul className="space-y-1">
        {(column.links ?? []).map((row, i) => {
          const link = resolveLink(row.link)
          if (!link) return null
          return (
            <li key={row.id ?? i}>
              <SmartLink
                href={link.href}
                external={link.external}
                newTab={link.newTab}
                className="inline-flex min-h-11 items-center text-sm text-white/75 transition-colors hover:text-white sm:min-h-9"
              >
                {link.label}
              </SmartLink>
            </li>
          )
        })}
      </ul>
    )
  }
  if (column.kind === 'contact') {
    const c = settings.contact
    const icon = 'mt-0.5 size-4 shrink-0 text-sky-300'
    return (
      <address className="space-y-3.5 text-sm not-italic text-white/75">
        {c?.address ? (
          <p className="flex gap-3 whitespace-pre-line">
            <MapPin className={icon} aria-hidden="true" />
            {c.address}
          </p>
        ) : null}
        {c?.phone ? (
          <p className="flex items-center gap-3">
            <Phone className={icon} aria-hidden="true" />
            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
              {c.phone}
            </a>
          </p>
        ) : null}
        {c?.email ? (
          <p className="flex items-center gap-3">
            <Mail className={icon} aria-hidden="true" />
            <a href={`mailto:${c.email}`} className="hover:text-white">
              {c.email}
            </a>
          </p>
        ) : null}
      </address>
    )
  }
  if (column.kind === 'social')
    return <SocialLinks social={settings.social} size="md" variant="glass" className="flex-wrap" />
  return column.text ? (
    <p className="whitespace-pre-line text-sm text-white/75">{column.text}</p>
  ) : null
}

/** Navy footer: brand + tagline, editor-defined columns (Quick Links · Quick Contact · Follow Us), bottom bar. */
export function Footer({ footer, settings }: { footer: FooterData; settings: SiteSetting }) {
  const bottom = (footer.bottomLinks ?? [])
    .map((r) => resolveLink(r.link))
    .filter((l) => l !== null)
  const columns = footer.columns ?? []
  return (
    <footer className="relative isolate mt-20 overflow-hidden bg-brand-deep text-white">
      <div
        className="bg-star-lattice pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        aria-hidden="true"
      />
      <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-16 lg:py-16">
        <div className="space-y-4">
          <Brand settings={settings} tone="light" />
          {settings.tagline ? (
            <p className="max-w-xs text-sm leading-relaxed text-white/70">{settings.tagline}</p>
          ) : null}
        </div>
        <div className={`grid gap-10 sm:grid-cols-2 ${columns.length > 2 ? 'lg:grid-cols-3' : ''}`}>
          {columns.map((column, i) => (
            <section key={column.id ?? i} aria-labelledby={`footer-col-${i}`}>
              <h2 id={`footer-col-${i}`} className="mb-4 text-base font-bold text-white">
                {column.title}
              </h2>
              <ColumnBody column={column} settings={settings} />
            </section>
          ))}
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center gap-3 py-5 text-center text-xs text-white/60 sm:flex-row sm:justify-between sm:text-start">
          <p>{footer.copyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {bottom.map((l, i) => (
              <SmartLink
                key={i}
                href={l.href}
                external={l.external}
                newTab={l.newTab}
                className="hover:text-white"
              >
                {l.label}
              </SmartLink>
            ))}
            <a
              href="#top"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white/80 hover:text-white sm:min-h-0"
            >
              മുകളിലേക്ക്
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </Container>
      </div>
    </footer>
  )
}
