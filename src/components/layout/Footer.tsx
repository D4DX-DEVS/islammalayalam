import { Container } from '@/components/ui/Container'
import { SmartLink } from '@/components/ui/SmartLink'
import { Brand } from '@/components/layout/Brand'
import { ContactDetails } from '@/components/layout/ContactDetails'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { withoutSiteName } from '@/lib/format'
import { resolveLink } from '@/lib/links'
import type { Footer as FooterData, SiteSetting } from '@/payload-types'

type Column = NonNullable<FooterData['columns']>[number]

function ColumnBody({ column, settings }: { column: Column; settings: SiteSetting }) {
  if (column.kind === 'links') {
    return (
      // Phones: compact wrapping chips instead of one tall row per link.
      <ul className="flex flex-wrap gap-2 lg:block lg:space-y-1">
        {(column.links ?? []).map((row, i) => {
          const link = resolveLink(row.link)
          if (!link) return null
          return (
            <li key={row.id ?? i}>
              <SmartLink
                href={link.href}
                external={link.external}
                newTab={link.newTab}
                className="inline-flex min-h-10 items-center rounded-full bg-white/10 px-3.5 text-[0.8rem] text-white/85 ring-1 ring-white/10 transition duration-200 hover:bg-white/15 hover:text-white lg:min-h-9 lg:rounded-none lg:bg-transparent lg:px-0 lg:text-sm lg:text-white/75 lg:ring-0 lg:hover:translate-x-1 lg:hover:bg-transparent"
              >
                {link.label}
              </SmartLink>
            </li>
          )
        })}
      </ul>
    )
  }
  if (column.kind === 'contact') return <ContactDetails contact={settings.contact} tone="dark" />
  if (column.kind === 'social')
    return (
      <SocialLinks
        social={settings.social}
        size="md"
        variant="fill"
        className="flex-wrap justify-center lg:justify-start"
      />
    )
  return column.text ? (
    <p className="whitespace-pre-line text-sm text-white/75">{column.text}</p>
  ) : null
}

/**
 * Royal-blue footer: brand, tagline and social buttons on the left, the editor-defined columns
 * (Quick Links · Quick Contact …) beside them and a bottom bar: copyright (without the site name the
 * logo already shows), bottom links and "Powered by". Back to top is the floating BackToTop button.
 * Phones get a compact version: centred brand row, link chips, tighter spacing.
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
    <footer className="bg-night relative isolate mt-8 overflow-hidden text-white lg:mt-10">
      <Container className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)] lg:gap-16 lg:py-16">
        <div
          data-reveal="fade"
          suppressHydrationWarning
          className="flex flex-col items-center space-y-4 text-center lg:items-start lg:space-y-5 lg:text-start"
        >
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
        <div
          className={`grid gap-7 sm:grid-cols-2 lg:gap-10 ${rest.length > 2 ? 'lg:grid-cols-3' : ''}`}
        >
          {rest.map((column, i) => (
            <section
              key={column.id ?? i}
              aria-labelledby={`footer-col-${i}`}
              data-reveal="up"
              suppressHydrationWarning
            >
              <h2 id={`footer-col-${i}`} className="mb-3 text-base font-bold text-white lg:mb-5">
                {column.title}
                <span className="mt-2 block h-0.5 w-8 rounded-full bg-accent" aria-hidden="true" />
              </h2>
              <ColumnBody column={column} settings={settings} />
            </section>
          ))}
        </div>
      </Container>
      <div className="border-t border-white/10 bg-black/10">
        <Container className="grid items-center gap-1.5 py-4 text-center sm:gap-3 sm:py-5 text-xs text-white/70 sm:grid-cols-[1fr_auto_1fr] sm:text-start">
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
