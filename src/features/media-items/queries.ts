import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import { isSafeHref, youtubeId } from '@/lib/security/url'
import { cached, PUBLIC } from '@/features/shared'
import { collectionTag } from '@/payload/hooks/revalidate'

/** A quick audio / video entry as the homepage needs it. Entries without a usable link are left out. */
export type MediaEntry = { id: string; link: string; title: string; author: string }

const MAX = 60

async function load(collection: 'audios' | 'videos', limit: number): Promise<MediaEntry[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection,
    sort: '-createdAt',
    limit: MAX,
    depth: 0,
    pagination: false,
    ...PUBLIC,
  })
  return res.docs
    .map((d) => ({
      id: String(d.id),
      link: (d.link ?? '').trim(),
      title: (d.title ?? '').trim(),
      author: (d.author ?? '').trim(),
    }))
    .filter((e) => e.link && isSafeHref(e.link) && (collection === 'audios' || youtubeId(e.link)))
    .slice(0, Math.max(0, limit))
}

/** Newest first. Cached; purged when an entry is saved (see payload/hooks/revalidate.ts). */
export const listAudioEntries = cached(
  'audios:list:v4',
  [collectionTag('audios')],
  (limit: number) => load('audios', limit),
)
export const listVideoEntries = cached(
  'videos:list:v4',
  [collectionTag('videos')],
  (limit: number) => load('videos', limit),
)
