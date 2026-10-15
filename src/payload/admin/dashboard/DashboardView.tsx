import type { Payload, SanitizedPermissions } from 'payload'
import { loadDashboard, type DashboardData } from '../dashboardData'
import { DashboardBody, type DashboardUser } from './DashboardBody'

/**
 * Replaces Payload's dashboard (admin.components.views.dashboard). Loads everything AS the signed-in
 * user (dashboardData.ts) and hands it to DashboardBody, which owns the layout.
 */
type Props = {
  payload: Payload
  permissions?: SanitizedPermissions
  user?: DashboardUser | null
}

export async function DashboardView({ payload, permissions, user }: Props) {
  if (!user) return null
  let data: DashboardData
  try {
    data = await loadDashboard(payload, user)
  } catch (err) {
    payload.logger.warn({ err }, 'Dashboard could not load')
    return (
      <div className="im-dash im-dash--view">
        <p className="im-dash__empty">The dashboard could not load. Reload the page to retry.</p>
      </div>
    )
  }
  return (
    <DashboardBody
      data={data}
      admin={payload.config.routes.admin}
      permissions={permissions}
      user={user}
    />
  )
}
