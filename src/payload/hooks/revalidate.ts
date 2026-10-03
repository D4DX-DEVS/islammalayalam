import { revalidateTag } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

/**
 * Cache tags shared by the frontend data layer (src/features/*) and these hooks.
 * `collectionTag` covers listings; `docTag` covers a single document's detail view.
 */
export const collectionTag = (slug: string): string => `c:${slug}`
export const docTag = (slug: string, id: string | number): string => `d:${slug}:${id}`
export const globalTag = (slug: string): string => `g:${slug}`

function safeRevalidate(req: PayloadRequest, tags: string[]): void {
  if (req.context.disableRevalidate) return
  for (const tag of tags) {
    try {
      revalidateTag(tag, 'max')
    } catch (err) {
      // Outside the Next.js runtime (payload CLI, seed, tests) there is no cache to purge.
      req.payload.logger.debug({ msg: 'revalidate skipped', tag, err: (err as Error).message })
    }
  }
}

export const revalidateCollection: CollectionAfterChangeHook = ({
  collection,
  doc,
  previousDoc,
  req,
}) => {
  const tags = [collectionTag(collection.slug), docTag(collection.slug, doc.id)]
  // Publishing state or relations may move the doc between listings, so listings always refresh.
  if (previousDoc?.id && previousDoc.id !== doc.id)
    tags.push(docTag(collection.slug, previousDoc.id))
  safeRevalidate(req, tags)
  return doc
}

export const revalidateCollectionDelete: CollectionAfterDeleteHook = ({ collection, doc, req }) => {
  safeRevalidate(req, [collectionTag(collection.slug), docTag(collection.slug, doc.id)])
  return doc
}

export const revalidateGlobal: GlobalAfterChangeHook = ({ global, doc, req }) => {
  safeRevalidate(req, [globalTag(global.slug)])
  return doc
}
