import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { loadWebsite } from '../websiteData'
import { WebsiteManager } from './WebsiteManager'

/**
 * Admin → Website manager (admin.components.views.website, path /website). Payload has already
 * required a signed-in session before this runs; the data is then read as that user, so a role only
 * sees (and can only open Edit links for) what its access rules allow.
 */
export async function WebsiteView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult
  const user = req.user
  if (!user) return null
  const payload = req.payload
  const admin = payload.config.routes.admin
  const data = await loadWebsite(payload, user, permissions)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <WebsiteManager
        data={data}
        mediaCreateHref={
          permissions?.collections?.media?.create ? `${admin}/collections/media/create` : null
        }
        postCreateHref={
          permissions?.collections?.posts?.create ? `${admin}/collections/posts/create` : null
        }
      />
    </DefaultTemplate>
  )
}
