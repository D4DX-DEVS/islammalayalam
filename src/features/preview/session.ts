import 'server-only'
import { cache } from 'react'
import { draftMode, headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { createLocalReq } from 'payload'
import type { Payload } from 'payload'
import { totpAccess } from 'payload-totp'
import { getPayloadClient } from '@/lib/payload'
import { encodePath } from '@/lib/text/slug'
import type { PreviewTarget } from '@/lib/preview'
import { isStaff } from '@/payload/access'
import type { User } from '@/payload-types'

/**
 * Who may see unpublished content on the public site: a staff member whose admin session is fully
 * signed in (password AND the TOTP step), checked with the same `totpAccess(isStaff)` rule the
 * REST API uses. The draft-mode cookie alone is never enough — it only says "try preview"; every
 * preview request re-checks the admin session, so logging out ends preview immediately.
 */
export type PreviewUser = User & { collection: 'users' }

export async function authenticatePreview(
  payload: Payload,
  requestHeaders: Request['headers'],
): Promise<PreviewUser | null> {
  try {
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user || user.collection !== 'users') return null
    const req = await createLocalReq({ user }, payload)
    return (await totpAccess(isStaff)({ req })) === true ? (user as PreviewUser) : null
  } catch (err) {
    unstable_rethrow(err)
    return null
  }
}

/** The preview user for this request, or null (draft mode off, signed out, or not verified). */
export const getPreviewUser = cache(async (): Promise<PreviewUser | null> => {
  let enabled: boolean
  try {
    enabled = (await draftMode()).isEnabled
  } catch (err) {
    unstable_rethrow(err) // Next's own control-flow signals must propagate
    return null // outside a request (scripts, tests, build-time code): never preview
  }
  if (!enabled) return null
  return authenticatePreview(await getPayloadClient(), await headers())
})

/**
 * Public path of the document being previewed, looked up AS the user (their read access applies).
 * Null when the document does not exist or has no public page yet.
 */
export async function previewPathOf(
  payload: Payload,
  user: PreviewUser,
  target: PreviewTarget,
): Promise<string | null> {
  if (target.kind === 'global') return '/'
  const as = { user, overrideAccess: false, disableErrors: true, depth: 0 } as const
  if (target.collection === 'posts') {
    const res = await payload.find({
      collection: 'posts',
      where: { id: { equals: target.id } },
      draft: true,
      select: { postNumber: true },
      limit: 1,
      pagination: false,
      ...as,
    })
    const n = res.docs[0]?.postNumber
    return typeof n === 'number' ? `/${n}/` : null
  }
  const res = await payload.find({
    collection: 'pages',
    where: { id: { equals: target.id } },
    select: { path: true },
    limit: 1,
    pagination: false,
    ...as,
  })
  const path = res.docs[0]?.path
  return typeof path === 'string' && path ? encodePath(`/${path}/`) : null
}
