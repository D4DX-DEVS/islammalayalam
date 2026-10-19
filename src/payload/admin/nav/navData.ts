import 'server-only'
import type { Payload, SanitizedPermissions } from 'payload'
import type { NavBadges } from './navModel'

/** The signed-in user as the sidebar needs them (the full user object also goes to Payload's local API). */
export type NavUser = {
  id: string | number
  name?: string | null
  email?: string
  role?: string | null
} & Record<string, unknown>

/** What the inbox counts: submissions nobody has opened yet. */
const WAITING: ReadonlyArray<{ slug: 'contact-messages' | 'postal-requests' }> = [
  { slug: 'contact-messages' },
  { slug: 'postal-requests' },
]

/**
 * Waiting-item counts for the sidebar. Read AS the signed-in user (`overrideAccess: false`), and only
 * for collections that user may read, so a role never learns about something it cannot open. A count
 * that fails to load just shows no badge; the sidebar itself must never break because of one.
 */
export async function loadNavBadges(
  payload: Payload,
  user: NavUser,
  permissions: SanitizedPermissions,
): Promise<NavBadges> {
  const entries = await Promise.all(
    WAITING.map(async ({ slug }) => {
      if (!permissions?.collections?.[slug]?.read) return [slug, 0] as const
      try {
        const { totalDocs } = await payload.count({
          collection: slug,
          where: { status: { equals: 'new' } },
          user,
          overrideAccess: false,
          disableErrors: true,
        })
        return [slug, totalDocs] as const
      } catch (err) {
        payload.logger.warn({ err, slug }, 'Sidebar count could not load')
        return [slug, 0] as const
      }
    }),
  )
  return Object.fromEntries(entries)
}
