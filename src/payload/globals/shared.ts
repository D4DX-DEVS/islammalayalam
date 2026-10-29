import type { GlobalConfig } from 'payload'
import { auditGlobalChange } from '@/payload/hooks/auditLog'
import { guardGlobalContent } from '@/payload/hooks/contentGuard'
import { revalidateGlobal } from '@/payload/hooks/revalidate'

/** Pieces every site global shares (index.ts, menus.ts). */

/** The Site area's tab bar, shown above each site global's form (with the global's description). */
export const siteTabs = {
  elements: { Description: '/payload/admin/site/SiteTabs#SiteTabs' },
} as const

export const hooks: GlobalConfig['hooks'] = {
  beforeValidate: [guardGlobalContent],
  afterChange: [revalidateGlobal, auditGlobalChange],
}
export const publicRead = () => true
