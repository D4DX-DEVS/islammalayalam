/**
 * Moves the imported "‘കിം’ പോസ്റ്റല്‍ ലൈബ്രറി" page (path postal-2) onto the request-form template —
 * `npm run content:postal-page` shows what would change, `APPLY=1 npm run content:postal-page`
 * does it. Runs against the database in .env (MONGODB_URI).
 *
 * The imported body is one long list of blocks: the page title, a subtitle, the introduction, the
 * conditions heading and list, and then the old form's field labels as plain paragraphs (the inputs
 * themselves were lost in the import). The labels are dropped, since the real form replaces them;
 * everything else is kept and re-homed in the page's own fields:
 *
 *   title      ← the first h2          intro    ← the h3 (the subtitle)
 *   content    ← the introduction      sections ← [{ title: the h4, content: the list }]
 *   template   ← postal-request
 *
 * Idempotent (a page already on the template is left alone). A JSON backup of the page is written
 * to the temp folder before any change, and the update is a normal version of the page, so it can
 * also be rolled back from the admin's Versions tab.
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { plainText } from '@/lib/text/lexical'

const PAGE_PATH = 'postal-2'
const FORM_MARKER = 'postal' // the paragraph that opens the old form's labels

type Node = { type?: string; tag?: string; children?: Node[]; [key: string]: unknown }

// `payload run` does not pass flags through to the script, so applying is switched on by APPLY=1.
const apply = process.env.APPLY === '1' || process.argv.includes('--apply')
const text = (node: Node) =>
  plainText(node as never)
    .replace(/\s+/g, ' ')
    .trim()
const heading = (nodes: Node[], tag: string) =>
  nodes.findIndex((n) => n.type === 'heading' && n.tag === tag)

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'pages',
    where: { path: { equals: PAGE_PATH } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const page = found.docs[0]
  if (!page) {
    console.error(`No page at "${PAGE_PATH}". Nothing to do.`)
    process.exit(1)
  }
  if (page.template === 'postal-request') {
    console.log(`"${page.title}" is already on the request-form template. Nothing to do.`)
    process.exit(0)
  }

  const root = (page.content as { root?: { children?: Node[] } } | null)?.root
  const blocks = root?.children ?? []
  const title = heading(blocks, 'h2')
  const subtitle = heading(blocks, 'h3')
  const conditions = heading(blocks, 'h4')
  const formAt = blocks.findIndex((n) => text(n) === FORM_MARKER)
  if (title !== 0 || subtitle !== 1 || conditions < 2 || formAt <= conditions) {
    console.error(
      'The page does not have the expected imported shape (h2, h3, introduction…, h4, list…, "postal" labels).',
      { title, subtitle, conditions, formAt },
    )
    process.exit(1)
  }

  const wrap = (children: Node[]) => ({ root: { ...root, children } })
  const subtitleText = blocks[subtitle]!.children ?? []
  const next = {
    title: text(blocks[title]!),
    template: 'postal-request' as const,
    intro: wrap([
      {
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: subtitleText,
      },
    ]),
    content: wrap(blocks.slice(subtitle + 1, conditions)),
    sections: [
      {
        title: text(blocks[conditions]!).replace(/[\s:：]+$/, ''),
        content: wrap(blocks.slice(conditions + 1, formAt)),
      },
    ],
  }

  console.log(`Page: ${page.title} (${page.path})`)
  console.log(`  title     → ${next.title}`)
  console.log(`  intro     → ${text(blocks[subtitle]!)}`)
  console.log(
    `  content   → ${blocks.slice(subtitle + 1, conditions).length} block(s) (introduction)`,
  )
  console.log(
    `  section   → "${next.sections[0]!.title}" with ${blocks.slice(conditions + 1, formAt).length} block(s)`,
  )
  console.log(`  dropped   → ${blocks.length - formAt} block(s) of old form labels`)
  console.log(`  template  → ${next.template}`)

  if (!apply) {
    console.log('\nDry run. Nothing was changed. Re-run with APPLY=1 to make this change.')
    process.exit(0)
  }

  const backup = path.join(tmpdir(), `page-${PAGE_PATH}-backup-${Date.now()}.json`)
  writeFileSync(backup, JSON.stringify(page, null, 2))
  console.log(`\nBackup written to ${backup}`)

  await payload.update({
    collection: 'pages',
    id: page.id,
    // The slug is passed back unchanged so a new title can never move the page's URL.
    data: { ...next, slug: page.slug } as never,
    depth: 0,
    overrideAccess: true,
    context: { actor: 'script:postal-library-page' },
  })
  console.log('Updated. The page is now on the request-form template.')
  process.exit(0)
}

// Top-level await: `payload run` exits as soon as this module finishes evaluating.
try {
  await main()
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
