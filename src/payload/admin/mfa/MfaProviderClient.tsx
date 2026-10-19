'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import { pendingMfaStep, type MfaRoutes, type MfaUser } from '@/lib/mfa-policy'

/** Same rule as MfaProvider for client-side navigation (e.g. right after the password form). */
export function MfaProviderClient({
  children,
  routes,
}: {
  children: ReactNode
  routes: MfaRoutes
}) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const step = pendingMfaStep(user as MfaUser | null, pathname, routes)
    if (step) router.push(`${routes[step]}?back=${encodeURIComponent(pathname)}`)
  }, [user, pathname, routes, router])

  return children
}
