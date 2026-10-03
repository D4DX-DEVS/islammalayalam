import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import type { Page } from '@/payload-types'

const TAGS = [collectionTag('pages'), collectionTag('media')]

export type PageLink = Pick<Page, 'id' | 'title' | 'path'>

export const getPageByPath = cached(
  'pages:by-path',
  TAGS,
  async (path: string): Promise<Page | null> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'pages',
      where: { path: { equals: path } },
      limit: 1,
      depth: 2,
      populate: POPULATE,
      pagination: false,
      ...PUBLIC,
    })
    return (res.docs[0] as Page | undefined) ?? null
  },
)

export const getChildPages = cached(
  'pages:children',
  TAGS,
  async (parentId: string): Promise<PageLink[]> => {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'pages',
      where: { parent: { equals: parentId } },
      sort: 'order',
      limit: 100,
      depth: 0,
      select: { title: true, path: true },
      pagination: false,
      ...PUBLIC,
    })
    return res.docs as PageLink[]
  },
)
