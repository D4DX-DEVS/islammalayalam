import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { collectionTag, globalTag } from '@/payload/hooks/revalidate'
import { cached, POPULATE, PUBLIC } from '@/features/shared'
import type { Footer, Header, Homepage, SiteSetting } from '@/payload-types'

const LINK_TAGS = [collectionTag('pages'), collectionTag('posts'), collectionTag('categories')]

export const getSiteSettings = cached(
  'site-settings',
  [globalTag('site-settings'), collectionTag('media')],
  async (): Promise<SiteSetting> => {
    const payload = await getPayloadClient()
    return payload.findGlobal({ slug: 'site-settings', depth: 1, populate: POPULATE, ...PUBLIC })
  },
)

export const getHeader = cached(
  'header',
  [globalTag('header'), ...LINK_TAGS],
  async (): Promise<Header> => {
    const payload = await getPayloadClient()
    return payload.findGlobal({ slug: 'header', depth: 1, populate: POPULATE, ...PUBLIC })
  },
)

export const getFooter = cached(
  'footer',
  [globalTag('footer'), ...LINK_TAGS],
  async (): Promise<Footer> => {
    const payload = await getPayloadClient()
    return payload.findGlobal({ slug: 'footer', depth: 1, populate: POPULATE, ...PUBLIC })
  },
)

export const getHomepage = cached(
  'homepage',
  [globalTag('homepage'), ...LINK_TAGS, collectionTag('media')],
  async (): Promise<Homepage> => {
    const payload = await getPayloadClient()
    return payload.findGlobal({ slug: 'homepage', depth: 1, populate: POPULATE, ...PUBLIC })
  },
)
