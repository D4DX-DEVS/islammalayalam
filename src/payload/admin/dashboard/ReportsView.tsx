import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { loadDashboard, type DashboardData } from '../dashboardData'
import type { DashboardUser } from './DashboardBody'
import { ReportsBody } from './ReportsBody'

/**
 * Admin → Reports (admin.components.views.reports, path /reports). Payload has already required a
 * signed-in session before this runs; the figures are then read as that user (dashboardData.ts), so
 * a role only counts what its access rules allow.
 */
export async function ReportsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult
  const user = req.user
  if (!user) return null
  const payload = req.payload
  let data: DashboardData | null = null
  try {
    data = await loadDashboard(payload, user as unknown as DashboardUser, 'reports')
  } catch (err) {
    payload.logger.warn({ err }, 'Reports could not load')
  }

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
      {data ? (
        <ReportsBody data={data} admin={payload.config.routes.admin} permissions={permissions} />
      ) : (
        <div className="im-dash im-dash--view">
          <p className="im-dash__empty">Reports could not load. Reload the page to retry.</p>
        </div>
      )}
    </DefaultTemplate>
  )
}
