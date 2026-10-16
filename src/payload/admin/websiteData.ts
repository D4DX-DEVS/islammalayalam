import 'server-only'
import type { Payload, SanitizedPermissions, Where } from 'payload'
import type { Category, User } from '@/payload-types'
import { aiSearchConfigured } from '@/features/ai-search/service'
import { buildWebsite, type SitePermissions, type WebsiteData } from './websiteModel'

/**
 * Gathers the Website manager's inputs AS the signed-in user (`overrideAccess: false`), exactly like
 * the dashboard: what a role may not read comes back empty, and every Edit link is only offered
 * where that role may update. The shaping itself is the pure buildWebsite() in websiteModel.ts.
 */
export type { WebsiteData } from './websiteModel'

export async function loadWebsite(
  payload: Payload,
  user: User,
  permissions: SanitizedPermissions | undefined,
): Promise<WebsiteData> {
  const as = { user, overrideAccess: false, disableErrors: true } as const
  const perms = permissions
  const can: SitePermissions = {
    readCollection: (slug) => Boolean(perms?.collections?.[slug]?.read),
    createCollection: (slug) => Boolean(perms?.collections?.[slug]?.create),
    updateCollection: (slug) => Boolean(perms?.collections?.[slug]?.update),
    updateGlobal: (slug) => Boolean(perms?.globals?.[slug]?.update),
  }

  const count = async (
    collection:
      | 'posts'
      | 'pages'
      | 'authors'
      | 'media'
      | 'redirects'
      | 'quotes'
      | 'audios'
      | 'videos',
    where?: Where,
  ) => {
    if (!can.readCollection(collection)) return null
    try {
      return (await payload.count({ collection, ...(where ? { where } : {}), ...as })).totalDocs
    } catch {
      return null
    }
  }
  const published = (format: string): Where => ({
    and: [{ format: { equals: format } }, { _status: { equals: 'published' } }],
  })

  const [
    homepage,
    header,
    footer,
    settings,
    categories,
    articles,
    videos,
    audios,
    ebooks,
    pages,
    authors,
    media,
    redirects,
    quotes,
    audiosWithoutAudio,
    audioItems,
    videoItems,
  ] = await Promise.all([
    payload.findGlobal({ slug: 'homepage', depth: 1, ...as }).catch(() => null),
    payload.findGlobal({ slug: 'header', depth: 0, ...as }).catch(() => null),
    payload.findGlobal({ slug: 'footer', depth: 0, ...as }).catch(() => null),
    payload.findGlobal({ slug: 'site-settings', depth: 0, ...as }).catch(() => null),
    payload
      .find({
        collection: 'categories',
        sort: 'order',
        limit: 60,
        depth: 0,
        pagination: false,
        ...as,
      })
      .then((r) => r.docs as Category[])
      .catch(() => [] as Category[]),
    count('posts', published('standard')),
    count('posts', published('video')),
    count('posts', published('audio')),
    count('posts', published('ebook')),
    count('pages'),
    count('authors'),
    count('media'),
    count('redirects'),
    count('quotes', { active: { equals: true } }),
    count('posts', {
      and: [
        { format: { equals: 'audio' } },
        { _status: { equals: 'published' } },
        { 'audio.url': { exists: false } },
        { 'audio.spotifyUrl': { exists: false } },
      ],
    }),
    count('audios'),
    count('videos'),
  ])

  return buildWebsite({
    admin: payload.config.routes.admin,
    can,
    homepage,
    header,
    footer,
    settings,
    categories,
    aiSearchOn: aiSearchConfigured(),
    counts: {
      articles,
      videos,
      audios,
      ebooks,
      pages,
      authors,
      media,
      redirects,
      quotes,
      audiosWithoutAudio,
      audioItems,
      videoItems,
    },
  })
}
