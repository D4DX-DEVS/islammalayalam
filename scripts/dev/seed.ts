/**
 * Development seed — `npm run seed:dev`. Idempotent; local `_dev`/`_test` MongoDB only.
 * Creates the dev admin (with a TOTP secret stored only in local .env), real category NAMES,
 * the original menu STRUCTURE (from audit/data/original-ia.json) as placeholder KB pages, and
 * clearly-labelled synthetic posts/images. Every write goes through the normal Payload hooks
 * (content guard, media guard), exactly like editor or migration writes.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import type { Payload, Where } from 'payload'
import { Secret } from 'otpauth'
import config from '@payload-config'
import { appendLocalEnv, assertLocalDevDatabase } from './guard'
import {
  decodeEntities,
  lexical,
  pageSegments,
  paragraph,
  placeholderImage,
  sampleBody,
  sampleTitle,
} from './fixtures'
import { seedGlobals } from './seed-globals'

type IaItem = { title: string; href: string; children?: IaItem[] }
type Slug = 'posts' | 'pages' | 'categories' | 'authors' | 'media' | 'users'
const CTX = { disableRevalidate: true, actor: 'dev-seed' }

export async function upsert(
  payload: Payload,
  collection: Slug,
  where: Where,
  data: Record<string, unknown>,
): Promise<string> {
  const found = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  })
  const existing = found.docs[0] as { id: string } | undefined
  if (existing) {
    await payload.update({ collection, id: existing.id, data, overrideAccess: true, context: CTX })
    return existing.id
  }
  const created = await payload.create({
    collection,
    data: data as never,
    overrideAccess: true,
    context: CTX,
  })
  return String(created.id)
}

async function seedAdmin(payload: Payload): Promise<void> {
  const email = process.env.DEV_ADMIN_EMAIL
  const password = process.env.DEV_ADMIN_PASSWORD
  if (!email || !password) throw new Error('DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD missing from .env')
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const user = found.docs[0] as { id: string; totpSecret?: string | null } | undefined
  let secret = process.env.DEV_ADMIN_TOTP_SECRET
  if (!secret) {
    secret = new Secret({ size: 20 }).base32
    appendLocalEnv('DEV_ADMIN_TOTP_SECRET', secret)
    payload.logger.info(
      'Dev admin TOTP secret written to .env (DEV_ADMIN_TOTP_SECRET) — add it to an authenticator app.',
    )
  }
  const data = { email, password, name: 'Dev Admin', role: 'admin' as const, totpSecret: secret }
  if (user)
    await payload.update({
      collection: 'users',
      id: user.id,
      data,
      overrideAccess: true,
      context: CTX,
    })
  else
    await payload.create({
      collection: 'users',
      data: data as never,
      overrideAccess: true,
      context: CTX,
    })
}

const CATEGORIES = [
  { name: 'സമകാലികം', slug: 'news', order: 10, posts: 6 },
  { name: 'ചോദ്യോത്തരം', slug: 'ചോദ്യോത്തരം', order: 20, posts: 6 },
  { name: 'ലേഖനം', slug: 'ലേഖനം', order: 30, posts: 6 },
  { name: 'കാഴ്ചപ്പാട്', slug: 'കാഴ്ചപ്പാട്', order: 40, posts: 3 },
  { name: 'Videos', slug: 'videos', order: 50, posts: 4, format: 'video' },
  { name: 'Audios', slug: 'audios', order: 60, posts: 2, format: 'audio' },
  { name: 'E-Books', slug: 'e-books', order: 70, posts: 3, format: 'ebook' },
  { name: 'സൗജന്യ പുസ്തകം', slug: 'സൗജന്യ-പുസ്തകം', order: 80, posts: 0 },
  { name: 'പ്രകാശം പരത്തിയ പ്രവാചകൻ', slug: 'പ്രകാശം-പരത്തിയ-പ്രവാചകൻ', order: 90, posts: 0 },
  { name: 'Uncategory', slug: 'uncategory', order: 999, posts: 0, hidden: true },
] as const

async function seedMedia(payload: Payload, count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const data = await placeholderImage(i)
    const sha = createHash('sha256').update(data).digest('hex')
    const found = await payload.find({
      collection: 'media',
      where: { sourceSha256: { equals: sha } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (found.docs[0]) {
      ids.push(String(found.docs[0].id))
      continue
    }
    const doc = await payload.create({
      collection: 'media',
      data: { alt: `മാതൃകാ ചിത്രം ${i + 1} (development placeholder)` },
      file: { data, mimetype: 'image/jpeg', name: `placeholder-${i + 1}.jpg`, size: data.length },
      overrideAccess: true,
      context: CTX,
    })
    ids.push(String(doc.id))
  }
  return ids
}

/** Placeholder images from earlier seed runs that no post uses any more (artwork changed). */
async function removeStalePlaceholders(payload: Payload, keep: string[]): Promise<void> {
  const stale = await payload.find({
    collection: 'media',
    where: { and: [{ alt: { like: 'development placeholder' } }, { id: { not_in: keep } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of stale.docs)
    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true, context: CTX })
}

async function seedPosts(
  payload: Payload,
  categoryIds: Map<string, string>,
  authorId: string,
  images: string[],
): Promise<void> {
  let n = 0
  for (const cat of CATEGORIES) {
    for (let i = 0; i < cat.posts; i++, n++) {
      const title = sampleTitle(cat.name, i)
      const noImage = n % 11 === 7 // audit: 55 legacy posts have no image → exercise the designed fallback
      await upsert(
        payload,
        'posts',
        { title: { equals: title } },
        {
          title,
          postNumber: 900001 + n,
          excerpt: 'വികസന പരിസ്ഥിതിക്കായുള്ള മാതൃകാ സംഗ്രഹം. യഥാർത്ഥ ഉള്ളടക്കം മൈഗ്രേഷനിലൂടെ വരും.',
          content: sampleBody(n),
          featuredImage: noImage ? null : images[n % images.length],
          format: 'format' in cat ? cat.format : 'standard',
          categories: [categoryIds.get(cat.slug)],
          author: authorId,
          featured: (cat.slug === 'news' || cat.slug === 'ലേഖനം') && i < 3,
          publishedAt: new Date(Date.UTC(2026, 8, 20) - n * 36e5 * 20).toISOString(),
          _status: 'published',
        },
      )
    }
  }
}

async function seedPages(payload: Payload, menu: IaItem[]): Promise<Map<string, string>> {
  const byPath = new Map<string, { title: string; kind: 'kb' | 'static' }>()
  const collect = (items: IaItem[]) =>
    items.forEach((item) => {
      const segs = pageSegments(item.href)
      if (segs) {
        segs.forEach((_, d) => {
          const p = segs.slice(0, d + 1).join('/')
          if (!byPath.has(p))
            byPath.set(p, {
              title: d === segs.length - 1 ? decodeEntities(item.title) : segs[d]!,
              kind: 'kb',
            })
        })
        byPath.set(segs.join('/'), { title: decodeEntities(item.title), kind: 'kb' })
      }
      collect(item.children ?? [])
    })
  collect(menu)
  byPath.set('about', { title: 'About Us', kind: 'static' })
  byPath.set('postal-2', { title: 'Postal Library', kind: 'static' })

  const ids = new Map<string, string>()
  const paths = [...byPath.keys()].sort((a, b) => a.split('/').length - b.split('/').length)
  for (const [i, path] of paths.entries()) {
    const { title, kind } = byPath.get(path)!
    const segs = path.split('/')
    const parent = segs.length > 1 ? ids.get(segs.slice(0, -1).join('/')) : null
    ids.set(
      path,
      await upsert(
        payload,
        'pages',
        { path: { equals: path } },
        {
          title,
          slug: segs[segs.length - 1],
          parent: parent ?? null,
          kind,
          order: i,
          intro: lexical([
            paragraph(
              'ഈ പേജിന്റെ ഘടന പഴയ സൈറ്റിന്റെ മെനുവിൽ നിന്നാണ്; ഉള്ളടക്കം മൈഗ്രേഷനിലൂടെ വരും.',
            ),
          ]),
          sections:
            kind === 'kb'
              ? [
                  { title: 'ഖുര്‍ആന്‍ സൂക്തങ്ങള്‍', content: sampleBody(i) },
                  { title: 'നബി വചനങ്ങള്‍', content: sampleBody(i + 1) },
                ]
              : [],
          content: kind === 'static' ? sampleBody(i) : null,
        },
      ),
    )
  }
  return ids
}

async function main(): Promise<void> {
  assertLocalDevDatabase()
  const payload = await getPayload({ config })
  const ia = JSON.parse(readFileSync('audit/data/original-ia.json', 'utf8')) as {
    menu: IaItem[]
    topbar: IaItem[][]
  }

  await seedAdmin(payload)
  const authorId = await upsert(
    payload,
    'authors',
    { slug: { equals: 'islam-malayalam' } },
    { name: 'Islam Malayalam', slug: 'islam-malayalam' },
  )
  const categoryIds = new Map<string, string>()
  for (const c of CATEGORIES) {
    categoryIds.set(
      c.slug,
      await upsert(
        payload,
        'categories',
        { slug: { equals: c.slug } },
        { name: c.name, slug: c.slug, order: c.order, hidden: 'hidden' in c },
      ),
    )
  }
  const images = await seedMedia(payload, 12)
  await seedPosts(payload, categoryIds, authorId, images)
  await removeStalePlaceholders(payload, images)
  const pageIds = await seedPages(payload, ia.menu)
  await seedGlobals(payload, { menu: ia.menu, categoryIds, pageIds, context: CTX })

  const counts = await Promise.all(
    (['posts', 'pages', 'categories', 'media'] as const).map(
      async (c) =>
        `${c}=${(await payload.count({ collection: c, overrideAccess: true })).totalDocs}`,
    ),
  )
  payload.logger.info(`Dev seed complete: ${counts.join(' ')}`)
  process.exit(0)
}

// Top-level await: `payload run` exits as soon as this module finishes evaluating.
try {
  await main()
} catch (err: unknown) {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
}
