import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import type { Payload } from 'payload'
import { pendingMfaStep, type MfaRoutes, type MfaUser } from '@/lib/mfa-policy'
import { MfaProviderClient } from './MfaProviderClient'

/**
 * Replaces payload-totp's admin provider (swapped in by src/payload/plugins/mfaPolicy.ts). While
 * Settings → Security requires two-step verification, a signed-in user who has not entered a code
 * yet is sent to the code screen, and one without an authenticator app to the QR setup screen.
 * With the setting off, nobody is redirected. Sign-out pages always stay reachable.
 */
type Props = { children: ReactNode; payload: Payload; user?: MfaUser | null }

export function mfaRoutes(payload: Payload): MfaRoutes {
  const adminRoute = payload.config.routes.admin
  const { logout = '/logout', inactivity = '/logout-inactivity' } = payload.config.admin.routes
  const url = (path: `/${string}`) => formatAdminURL({ adminRoute, path })
  return {
    verify: url('/verify-totp'),
    setup: url('/setup-totp'),
    open: [url(logout as `/${string}`), url(inactivity as `/${string}`)],
  }
}

export async function MfaProvider({ children, payload, user }: Props) {
  const routes = mfaRoutes(payload)
  // x-pathname is always set by src/proxy.ts (client input is overwritten).
  const pathname = (await headers()).get('x-pathname') || '/'
  const step = pendingMfaStep(user, pathname, routes)
  if (step)
    redirect(`${payload.config.serverURL}${routes[step]}?back=${encodeURIComponent(pathname)}`)
  return <MfaProviderClient routes={routes}>{children}</MfaProviderClient>
}
