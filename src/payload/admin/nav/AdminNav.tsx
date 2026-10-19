import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import { getTranslation } from '@payloadcms/translations'
import type { I18nClient } from '@payloadcms/translations'
import type { Payload, SanitizedPermissions, VisibleEntities } from 'payload'
import { AdminNavClient } from './AdminNavClient'
import { loadNavBadges, type NavUser } from './navData'
import { buildNavGroups, type NavEntity } from './navModel'

/**
 * Replaces Payload's sidebar (admin.components.Nav). Same entities and permission filtering as the
 * default nav (visibleEntities + each entity's read permission), grouped by job (navModel.ts) with
 * waiting-item counts on the Inbox, and rendered as a dark navy sidebar (AdminNavClient). NavWrapper
 * / NavHamburger keep Payload's open/close behaviour on mobile and desktop.
 */
type Props = {
  payload: Payload
  permissions: SanitizedPermissions
  i18n: I18nClient
  visibleEntities: VisibleEntities
  user?: NavUser | null
}

export async function AdminNav({ payload, permissions, i18n, visibleEntities, user }: Props) {
  const { collections, globals } = payload.config
  const entities: NavEntity[] = [
    ...collections
      .filter(
        ({ slug }) =>
          visibleEntities.collections.includes(slug) &&
          Boolean(permissions?.collections?.[slug]?.read),
      )
      .map(({ slug, labels }) => ({
        slug,
        kind: 'collection' as const,
        label: getTranslation(labels.plural, i18n),
      })),
    ...globals
      .filter(
        ({ slug }) =>
          visibleEntities.globals.includes(slug) && Boolean(permissions?.globals?.[slug]?.read),
      )
      .map(({ slug, label }) => ({
        slug,
        kind: 'global' as const,
        label: getTranslation(label, i18n),
      })),
  ]
  const badges = user ? await loadNavBadges(payload, user, permissions) : {}

  return (
    <NavWrapper baseClass="nav">
      <AdminNavClient
        groups={buildNavGroups({ entities, badges })}
        user={{
          name: user?.name ?? '',
          email: user?.email ?? '',
          role: user?.role ?? '',
        }}
      />
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  )
}
