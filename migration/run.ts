/**
 * WordPress → Payload migration — `npm run migrate -- target=local [limit=N] [dry-run]` (see README).
 *
 * Reads the sanitized audit snapshot (never the live WordPress site, except /wp-content/uploads/
 * files fetched into memory by Gate B), runs every record through the gates, and upserts it keyed
 * by its WordPress id, so re-runs are safe. The target (local migration database, or production
 * with an explicit confirmation token) is resolved from .env BEFORE the Payload config is imported;
 * credentials are never printed.
 */
import { readFileSync } from 'node:fs'
import { redact } from './lib/redact'
import { parseArgs } from './lib/args'
import { resolveTarget, TargetError } from './lib/target'

/** Run `fn` over `items` with at most `size` in flight. */
async function pool<T>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) await fn(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const opts = parseArgs(args)
  const target = resolveTarget(opts.target, process.env, args)
  // Must happen before anything reads the environment (the Payload config, storage, env schema).
  Object.assign(process.env, target.overrides)

  const [{ getPayload }, { default: config }, { Run }, { loadSnapshot }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
    import('./lib/run'),
    import('./lib/snapshot'),
  ])
  const [
    { migrateAuthor, migrateCategories },
    { MediaMigrator },
    { mediaNeeds, migratePost },
    { menuOrder, migratePages, pageMediaNeeds },
    { migrateRedirects, plannedRedirects },
    { pagePaths },
    { classifyPages, isDemoPost },
    { migrateGlobals },
    { ensureLocalReviewAdmin },
    { verifyTarget },
  ] = await Promise.all([
    import('./load/taxonomy'),
    import('./load/media'),
    import('./load/posts'),
    import('./load/pages'),
    import('./load/redirects'),
    import('./transform/paths'),
    import('./lib/exclusions'),
    import('./load/globals'),
    import('./load/admin'),
    import('./verify'),
  ])

  const payload = await getPayload({ config })
  const run = new Run(payload, target.description, opts.dryRun)
  run.overwriteEdited = opts.overwriteEdited
  run.log(`run ${run.runId} → ${target.description}${opts.dryRun ? ' (dry run)' : ''}`)
  const started = Date.now()
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`

  try {
    const snap = loadSnapshot()
    for (const r of snap.rejected) {
      if (
        r.entity !== 'post' &&
        r.entity !== 'page' &&
        r.entity !== 'category' &&
        r.entity !== 'media'
      )
        continue
      run.tally(r.entity, 'source')
      run.issue({
        entity: r.entity,
        wpId: r.wpId,
        gate: 'A-source',
        severity: 'rejected',
        summary: `malicious-content indicators survived cleaning (${r.iocs.join(', ')})`,
      })
    }
    const posts = [...snap.posts].sort((a, b) => a.id - b.id).slice(0, opts.limit)

    const categories = await migrateCategories(run, snap.categories)
    const authorId = await migrateAuthor(run)
    run.log(`categories + author done (${elapsed()})`)

    const kinds = classifyPages(snap.pages)
    const realPages = snap.pages.filter((p) => kinds.get(p.id) !== 'demo')

    // Media first, in parallel: every file a migrated post or page uses (featured + inline + linked).
    const media = new MediaMigrator(run, snap.media)
    const needs: Array<string | NonNullable<ReturnType<typeof media.libraryItem>>> = []
    for (const r of [...posts.filter((p) => !isDemoPost(p)), ...realPages]) {
      const featured = r.featured_media ? media.libraryItem(r.featured_media) : undefined
      if (featured) needs.push(featured)
    }
    for (const p of posts) needs.push(...mediaNeeds(p))
    for (const p of realPages) needs.push(...pageMediaNeeds(p, kinds.get(p.id)))
    let done = 0
    await pool(needs, opts.concurrency, async (n) => {
      await media.ensure(n)
      if (++done % 50 === 0) run.log(`media ${done}/${needs.length} (${elapsed()})`)
    })
    run.log(`media done (${elapsed()})`)

    const ia = JSON.parse(readFileSync('audit/data/original-ia.json', 'utf8')) as {
      menu: Parameters<typeof migrateGlobals>[1]
    }
    const content = { categories, pagePaths: pagePaths(realPages), media }
    await migratePages(run, snap.pages, { ...content, kinds, menuOrder: menuOrder(ia.menu) })
    run.log(`pages done (${elapsed()})`)

    const postDeps = { ...content, authorId, all: snap.posts }
    for (const [i, p] of posts.entries()) {
      await migratePost(run, p, postDeps)
      if ((i + 1) % 50 === 0) run.log(`posts ${i + 1}/${posts.length} (${elapsed()})`)
    }
    run.log(`posts done (${elapsed()})`)

    await migrateRedirects(
      run,
      plannedRedirects({
        posts: snap.posts,
        categories: snap.categories,
        kinds,
        allPagePaths: pagePaths(snap.pages),
      }),
    )
    run.log(`redirects done (${elapsed()})`)

    await migrateGlobals(run, ia.menu)
    if (opts.target === 'local') await ensureLocalReviewAdmin(run)
    if (!opts.dryRun) {
      await verifyTarget(run, { posts: run.counts.post, pages: run.counts.page })
      run.log(`verification done (${elapsed()})`)
    }

    // Recorded as a failed run (catch below); the report lists what failed.
    if (run.blocked) throw new TargetError('verification failed a security check — see the report')
    await run.persist('completed')
    run.log(`report: ${run.writeReport()}`)
    run.log(`counts ${JSON.stringify(run.counts)}`)
  } catch (err) {
    await run.persist('failed').catch(() => undefined)
    run.writeReport()
    throw err
  }
}

// Top-level await: `payload run` exits as soon as this module finishes evaluating.
try {
  await main()
  process.exit(0)
} catch (err: unknown) {
  const text =
    err instanceof TargetError
      ? `migration: ${err.message}`
      : err instanceof Error
        ? (err.stack ?? err.message)
        : String(err)
  console.error(redact(text))
  process.exit(1)
}
