import { Mail, MapPin, Phone } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { Brand } from '@/components/layout/Brand'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { withoutSiteName } from '@/lib/format'
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
                className="inline-flex min-h-11 items-center text-sm text-white/75 transition duration-200 hover:translate-x-1 hover:text-white sm:min-h-9"
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
    const chip =
      'inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10'
    const icon = 'size-4 shrink-0 text-sky-300'
    return (
      <address className="space-y-3 text-sm not-italic text-white/75">
        {c?.address ? (
          <p className="flex gap-3 whitespace-pre-line">
            <span className={chip}>
              <MapPin className={icon} aria-hidden="true" />
            </span>
            <span className="pt-1.5">{c.address}</span>
          </p>
        ) : null}
        {c?.phone ? (
          <p className="flex items-center gap-3">
            <span className={chip}>
              <Phone className={icon} aria-hidden="true" />
            </span>
            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
              {c.phone}
            </a>
          </p>
        ) : null}
        {c?.email ? (
          <p className="flex items-center gap-3">
            <span className={chip}>
              <Mail className={icon} aria-hidden="true" />
            </span>
            <a href={`mailto:${c.email}`} className="hover:text-white">
              {c.email}
            </a>
          </p>
        ) : null}
      </address>
    )
  }
  if (column.kind === 'social')
    return <SocialLinks social={settings.social} size="md" variant="fill" className="flex-wrap" />
  return column.text ? (
    <p className="whitespace-pre-line text-sm text-white/75">{column.text}</p>
  ) : null
}

/**
 * Royal-blue footer: brand, tagline and social buttons on the left, the editor-defined columns
 * (Quick Links · Quick Contact …) beside them and a bottom bar: copyright (without the site name the
 * logo already shows), bottom links and "Powered by". Back to top is the floating BackToTop button.
 */
export function Footer({ footer, settings }: { footer: FooterData; settings: SiteSetting }) {
  const bottom = (footer.bottomLinks ?? [])
    .map((r) => resolveLink(r.link))
    .filter((l) => l !== null)
  const copyright = withoutSiteName(footer.copyright, [settings.siteName, settings.siteNameMl])
  const columns = footer.columns ?? []
  const social = columns.find((c) => c.kind === 'social')
  const rest = columns.filter((c) => c.kind !== 'social')
  return (
    <footer className="bg-night relative isolate mt-16 overflow-hidden text-white lg:mt-20">
      <Container className="grid gap-12 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)] lg:gap-16 lg:py-16">
        <div data-reveal="fade" suppressHydrationWarning className="space-y-5">
          <Brand settings={settings} tone="light" />
          {settings.tagline ? (
            <p className="max-w-sm text-sm leading-relaxed text-white/75">{settings.tagline}</p>
          ) : null}
          {social ? (
            <section aria-label={social.title}>
              <ColumnBody column={social} settings={settings} />
            </section>
          ) : null}
        </div>
        <div className={`grid gap-10 sm:grid-cols-2 ${rest.length > 2 ? 'lg:grid-cols-3' : ''}`}>
          {rest.map((column, i) => (
            <section
              key={column.id ?? i}
              aria-labelledby={`footer-col-${i}`}
              data-reveal="up"
              suppressHydrationWarning
            >
              <h2 id={`footer-col-${i}`} className="mb-5 text-base font-bold text-white">
                {column.title}
                <span className="mt-2 block h-0.5 w-8 rounded-full bg-accent" aria-hidden="true" />
              </h2>
              <ColumnBody column={column} settings={settings} />
            </section>
          ))}
        </div>
      </Container>
      <div className="border-t border-white/10 bg-black/10">
        <Container className="grid items-center gap-3 py-5 text-center text-xs text-white/70 sm:grid-cols-[1fr_auto_1fr] sm:text-start">
          <p>{copyright}</p>
          <div className="flex flex-wrap items-center justify-center divide-x divide-white/25">
            {bottom.map((l, i) => (
              <SmartLink
                key={i}
                href={l.href}
                external={l.external}
                newTab={l.newTab}
                className="px-3.5 transition-colors first:ps-0 last:pe-0 hover:text-white"
              >
                {l.label}
              </SmartLink>
            ))}
          </div>
          <p className="sm:justify-self-end">
            Powered by:{' '}
            <a
              href="https://d4dx.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              D4DX Innovations LLP
            </a>
          </p>
        </Container>
      </div>
    </footer>
  )
}
