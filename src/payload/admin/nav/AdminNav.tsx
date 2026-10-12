import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import { getTranslation } from '@payloadcms/translations'
import { EntityType, groupNavItems } from '@payloadcms/ui/shared'
import type { I18nClient } from '@payloadcms/translations'
import type { Payload, SanitizedPermissions, VisibleEntities } from 'payload'
import { AdminNavClient, type NavGroupData } from './AdminNavClient'

/**
 * Replaces Payload's sidebar (admin.components.Nav). Same entities and permission filtering as the
 * default nav (groupNavItems + visibleEntities), rendered as a modern sidebar with icons, an
 * active state, collapsible groups and the signed-in user at the bottom. NavWrapper/NavHamburger
 * keep Payload's open/close behaviour on mobile and desktop.
 */
type Props = {
  payload: Payload
  permissions: SanitizedPermissions
  i18n: I18nClient
  visibleEntities: VisibleEntities
  user?: { name?: string | null; email?: string; role?: string | null } | null
}

export function AdminNav({ payload, permissions, i18n, visibleEntities, user }: Props) {
  const { collections, globals } = payload.config
  const groups = groupNavItems(
    [
      ...collections
        .filter(({ slug }) => visibleEntities.collections.includes(slug))
        .map((entity) => ({ type: EntityType.collection as const, entity })),
      ...globals
        .filter(({ slug }) => visibleEntities.globals.includes(slug))
        .map((entity) => ({ type: EntityType.global as const, entity })),
    ],
    permissions,
    i18n,
  )
  const data: NavGroupData[] = groups.map((group) => ({
    label: group.label,
    items: group.entities.map((e) => ({
      slug: e.slug,
      kind: e.type === EntityType.collection ? 'collection' : 'global',
      label: getTranslation(e.label, i18n),
    })),
  }))

  return (
    <NavWrapper baseClass="nav">
      <AdminNavClient
        groups={data}
        user={{ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? '' }}
      />
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  )
}
