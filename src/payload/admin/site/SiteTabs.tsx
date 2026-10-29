'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getTranslation } from '@payloadcms/translations'
import { useAuth, useConfig, useTranslation } from '@payloadcms/ui'
import { SITE_GLOBALS } from '../nav/navModel'

/**
 * The tab bar of the Site area: Overview (the Website manager) and one tab per site-wide setting.
 * The sidebar has a single "Site" row for all of them (navModel.ts), so this is how editors move
 * between them. Rendered at the top of the Website manager and, as each site global's
 * `admin.components.elements.Description`, at the top of its form, followed by that global's own
 * description. Tabs the role may not open are left out.
 */
export function SiteTabs({ description }: { description?: string }) {
  const pathname = usePathname()
  const { config } = useConfig()
  const { permissions } = useAuth()
  const { i18n } = useTranslation()
  const admin = config.routes.admin

  const tabs = [
    { key: 'overview', href: `${admin}/website`, label: 'Overview' },
    ...SITE_GLOBALS.flatMap((slug) => {
      const global = config.globals.find((g) => g.slug === slug)
      if (!global || !permissions?.globals?.[slug]?.read) return []
      return [
        { key: slug, href: `${admin}/globals/${slug}`, label: getTranslation(global.label, i18n) },
      ]
    }),
  ]
  const current = pathname.replace(/\/+$/, '')
  const global = config.globals.find((g) => current === `${admin}/globals/${g.slug}`)
  const text =
    description ?? (typeof global?.admin?.description === 'string' ? global.admin.description : '')

  return (
    <div className="im-site-tabs">
      <nav aria-label="Site settings" className="im-site-tabs__bar">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            className="im-site-tabs__tab"
            aria-current={current === tab.href ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {text ? <p className="im-site-tabs__desc">{text}</p> : null}
    </div>
  )
}
