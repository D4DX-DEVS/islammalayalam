import 'server-only'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { after } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached } from '@/features/shared'

export type RedirectHit = { id: string; to: string | null; code: '301' | '308' | '410' }

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
    return doc ? { id: String(doc.id), to: doc.to ?? null, code: doc.code } : null
  },
)

/**
 * Count one served visit on a redirect row, after the response is sent. A raw $inc, not a Payload
 * update: that would run the collection hooks (cache purge + activity log) on every visit.
 * Production only — local dev reads the live database.
 */
export function countRedirectHit(id: string | undefined): void {
  // An id-less filter would match an arbitrary row (e.g. a cache entry written before ids were kept).
  if (!id || process.env.NODE_ENV !== 'production') return
  after(async () => {
    const payload = await getPayloadClient()
    try {
      const db = payload.db as unknown as MongooseAdapter
      await db.collections.redirects!.updateOne({ _id: id }, { $inc: { hits: 1 } })
    } catch (error) {
      payload.logger.warn({ msg: 'Redirect hit not counted', id, error })
    }
  })
}
