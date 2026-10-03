import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached } from '@/features/shared'

export type RedirectHit = { to: string | null; code: '301' | '308' | '410' }

/** Look up a canonical path (/a/b/) in the redirects table. Staff-only collection → server-only read. */
export const findRedirect = cached(
  'redirects:by-from',
  [collectionTag('redirects')],
  async (from: string): Promise<RedirectHit | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      limit: 1,
      depth: 0,
      select: { to: true, code: true },
      overrideAccess: true,
      pagination: false,
    })
    const doc = res.docs[0]
    return doc ? { to: doc.to ?? null, code: doc.code } : null
  },
)
