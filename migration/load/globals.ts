import { seedGlobals } from '../../scripts/dev/seed-globals'
import type { Run } from '../lib/run'

type IaItem = { title: string; href: string; children?: IaItem[] }

/**
 * Site settings, header menu, homepage and footer, built from the original site's menu
 * (audit/data/original-ia.json) and the migrated categories/pages. Written only while ALL of them
 * are still empty: once any has content, they are the editors' settings and a re-run must never
 * overwrite them.
 */
export async function migrateGlobals(run: Run, menu: IaItem[]): Promise<void> {
  const { payload } = run
  run.tally('menu', 'source')
  const read = (slug: 'header' | 'homepage' | 'footer' | 'site-settings') =>
    payload.findGlobal({ slug, depth: 0, overrideAccess: true }) as unknown as Promise<
      Record<string, unknown>
    >
  const [header, homepage, footer, settings] = await Promise.all([
    read('header'),
    read('homepage'),
    read('footer'),
    read('site-settings'),
  ])
  // Lists editors fill in, plus "site settings were ever saved" (its fields have default values,
  // so their content alone cannot tell a fresh site from a configured one).
  const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v))
  if (
    [header.mainMenu, header.topBarLinks, homepage.layout, footer.columns, settings.updatedAt].some(
      filled,
    )
  ) {
    run.tally('menu', 'unchanged')
    return
  }
  if (run.dryRun) {
    run.tally('menu', 'created')
    return
  }
  const [categories, pages] = await Promise.all([
    payload.find({
      collection: 'categories',
      limit: 0,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    }),
    payload.find({
      collection: 'pages',
      limit: 0,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    }),
  ])
  await seedGlobals(payload, {
    menu,
    categoryIds: new Map(categories.docs.map((c) => [c.slug, String(c.id)])),
    pageIds: new Map(pages.docs.filter((p) => p.path).map((p) => [p.path!, String(p.id)])),
    context: run.context,
  })
  run.tally('menu', 'created')
}
