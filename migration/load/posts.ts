import { youtubeId } from '@/lib/security/url'
import { gateHtml } from '../gates/html'
import {
  FORMAT_BY_CATEGORY,
  HIDDEN_CATEGORY_IDS,
  isDemoPost,
  isSuspectDate,
  SLIDER_CATEGORY_ID,
} from '../lib/exclusions'
import type { Run } from '../lib/run'
import type { WpPost } from '../lib/snapshot'
import { deriveTitle, htmlToText, summary } from '../lib/text'
import { decodeSlug, repairedDate, toIso } from '../transform/paths'
import { takeVideo } from '../transform/video'
import {
  convert,
  droppedImagesNote,
  removedLinksNotes,
  resolveMedia,
  uploadRefs,
  type ContentDeps,
} from './content'
import type { MediaMigrator, MigratedMedia } from './media'
import { upsert } from './taxonomy'

/**
 * Posts: Gate A on the body, media first (featured image, inline images, linked PDFs), then the
 * Lexical conversion with those ids, then an upsert keyed by the WordPress id — which is also the
 * public post number, so /<id>/ keeps working. Problems become review flags, not silent fixes.
 */
export type PostDeps = ContentDeps & { authorId: string; all: WpPost[] }

/** Upload URLs a post references (so all media can be migrated, in parallel, before any post). */
export function mediaNeeds(post: WpPost): string[] {
  if (isDemoPost(post)) return []
  const gate = gateHtml(post.content)
  return gate.ok ? uploadRefs(gate.html) : []
}

/** The featured image (posts and pages), with a review note when it could not be kept. */
export async function featuredImage(
  media: MediaMigrator,
  record: { id: number; featured_media: number },
  notes: string[],
): Promise<string | undefined> {
  if (!record.featured_media) return undefined
  const item = media.libraryItem(record.featured_media)
  if (!item) {
    notes.push('featured image missing in WordPress')
    return undefined
  }
  const m = await media.ensure(item, record.id)
  if (!m) notes.push('featured image not migrated (see media issues)')
  return m && m.kind.startsWith('image/') ? m.id : undefined
}

/** No usable featured image: the first picture in the post's own text stands in (as the old theme did). */
export function firstContentImage(
  resolved: ReadonlyMap<string, Pick<MigratedMedia, 'id' | 'kind'>>,
): string | undefined {
  for (const m of resolved.values()) if (m.kind.startsWith('image/')) return m.id
  return undefined
}

export async function migratePost(run: Run, post: WpPost, deps: PostDeps): Promise<void> {
  run.tally('post', 'source')
  if (isDemoPost(post)) {
    run.tally('post', 'excluded')
    return
  }
  const gate = gateHtml(post.content)
  if (!gate.ok) {
    run.issue({
      entity: 'post',
      wpId: post.id,
      gate: 'A-source',
      severity: 'rejected',
      summary: `malicious-content indicators survived cleaning (${gate.iocs.join(', ')})`,
    })
    return
  }
  const notes: string[] = []

  // Media (already migrated in the media stage; these calls just resolve the results).
  const resolved = await resolveMedia(deps.media, [gate.html], post.id)
  let featured = await featuredImage(deps.media, post, notes)
  if (!featured) {
    featured = firstContentImage(resolved)
    if (featured) notes.push('featured image taken from the first picture in the text')
  }
  const converted = convert(gate.html, `post:${post.id}`, resolved, deps)
  const dropped = droppedImagesNote(converted)
  if (dropped) notes.push(dropped)
  notes.push(...removedLinksNotes([converted]))

  const bodyText = htmlToText(gate.html)
  let title = htmlToText(post.title)
  const titleDerived = !title
  if (titleDerived) {
    title = deriveTitle(bodyText) || `Post ${post.id}`
    notes.push('title written from the first sentence')
  }

  // Format: WordPress format, else the category the old theme used for media shelves.
  const byCategory = post.categories.map((c) => FORMAT_BY_CATEGORY[c]).find(Boolean)
  const format =
    post.format === 'video' || post.format === 'audio' ? post.format : (byCategory ?? 'standard')
  const videoUrl =
    format === 'video'
      ? takeVideo(converted.state.root as unknown as Parameters<typeof takeVideo>[0])
      : null
  if (format === 'video' && !videoUrl)
    notes.push('video link was kept in a WordPress plugin: add it under "Media & files"')
  if (format === 'audio')
    notes.push('audio link was kept in a WordPress plugin: add it under "Media & files"')
  const attachments =
    format === 'ebook'
      ? [...new Map([...resolved.values()].map((m) => [m.id, m])).values()]
          .filter((m) => m.kind === 'application/pdf')
          .slice(0, 20)
          .map((m) => ({ file: m.id, label: title.slice(0, 160) }))
      : []
  if (format === 'ebook' && !attachments.length)
    notes.push('e-book has no PDF: attach one under "Media & files"')

  const suspect = isSuspectDate(post.date_gmt)
  const publishedAt = suspect ? repairedDate(post, deps.all) : toIso(post.date_gmt)
  if (suspect)
    notes.push(`publish date was tampered in WordPress (${post.date_gmt.slice(0, 10)}); estimated`)

  // Visible categories first, so the primary category (breadcrumb, card label) is never "Uncategorized".
  const categoryIds = [...post.categories]
    .sort((a, b) => Number(HIDDEN_CATEGORY_IDS.has(a)) - Number(HIDDEN_CATEGORY_IDS.has(b)))
    .map((c) => deps.categories.get(c)?.id)
    .filter((id): id is string => Boolean(id))
  if (!categoryIds.length) notes.push('no category')
  const slug = decodeSlug(post.slug)

  const data = {
    title: title.slice(0, 300),
    excerpt: summary(post.excerpt, bodyText, 300) || undefined,
    content: converted.state,
    format,
    video: videoUrl && youtubeId(videoUrl) ? { url: videoUrl } : undefined,
    attachments,
    postNumber: post.id,
    publishedAt,
    categories: categoryIds,
    primaryCategory: categoryIds[0],
    author: deps.authorId,
    featured: post.categories.includes(SLIDER_CATEGORY_ID) || Boolean(post.sticky),
    featuredImage: featured,
    _status: 'published' as const,
    flags: {
      needsReview: notes.length > 0,
      titleDerived,
      dateSuspect: suspect,
      reviewNote: notes.join(' · ').slice(0, 1000) || undefined,
    },
    legacy: {
      wpId: post.id,
      legacySlugs: slug && !/^\d+$/.test(slug) ? [slug] : [],
      legacyUrls: [post.link].filter(Boolean),
    },
  }

  try {
    await upsert(run, 'post', 'posts', { 'legacy.wpId': { equals: post.id } }, data, {
      draft: false,
    })
  } catch (err) {
    run.issue({
      entity: 'post',
      wpId: post.id,
      gate: 'C-content',
      severity: 'rejected',
      summary: `refused by the CMS content guard: ${(err as Error).message}`,
    })
    return
  }
  for (const note of notes)
    run.issue({
      entity: 'post',
      wpId: post.id,
      gate: 'validation',
      severity: 'warning',
      summary: note,
    })
}
