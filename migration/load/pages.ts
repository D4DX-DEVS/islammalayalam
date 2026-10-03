import { normalizePath, normalizeSlug, toPath } from '@/lib/text/slug'
import { gateHtml } from '../gates/html'
import type { PageKind } from '../lib/exclusions'
import { hashOf, type Run } from '../lib/run'
import type { WpPage } from '../lib/snapshot'
import { htmlToText } from '../lib/text'
import { decodeSlug } from '../transform/paths'
import { pageModel } from '../transform/shortcodes'
import {
  convert,
  droppedImagesNote,
  removedLinksNotes,
  resolveMedia,
  uploadRefs,
  type ContentDeps,
} from './content'
import { featuredImage } from './posts'
import { upsert } from './taxonomy'

/**
 * Knowledge-base and static pages. WPBakery shortcodes → body + tabbed sections (see
 * transform/shortcodes.ts); every piece passes Gate A; parents are written before children so the
 * CMS computes the same hierarchical path WordPress used. Demo pages are counted and skipped (their
 * URLs get a 410 in the redirects stage).
 */
export type PageDeps = ContentDeps & {
  kinds: Map<number, PageKind>
  /** Original menu order by canonical path (audit/data/original-ia.json). */
  menuOrder: Map<string, number>
}

type Gated = { body: string; sections: Array<{ title: string; html: string }>; warnings: string[] }

/** Page body + sections after Gate A; the indicators found if any piece fails. */
function gatePage(page: WpPage): { ok: true; model: Gated } | { ok: false; iocs: string[] } {
  const model = pageModel(page.content)
  const body = gateHtml(model.body)
  const sections = model.sections.map((s) => ({ title: s.title, gate: gateHtml(s.html) }))
  const iocs = [body, ...sections.map((s) => s.gate)].flatMap((g) => (g.ok ? [] : g.iocs))
  if (iocs.length || !body.ok) return { ok: false, iocs: [...new Set(iocs)] }
  return {
    ok: true,
    model: {
      body: body.html,
      sections: sections.map((s) => ({ title: s.title, html: s.gate.ok ? s.gate.html : '' })),
      warnings: model.warnings,
    },
  }
}

/** Upload URLs a migrated page references (media stage). */
export function pageMediaNeeds(page: WpPage, kind: PageKind | undefined): string[] {
  if (!kind || kind === 'demo') return []
  const gated = gatePage(page)
  return gated.ok
    ? [gated.model.body, ...gated.model.sections.map((s) => s.html)].flatMap(uploadRefs)
    : []
}

/** Menu order by canonical path: original-ia.json lists the site menu in display order. */
export function menuOrder(
  menu: Array<{ href: string; children?: unknown[] }>,
): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (items: Array<{ href: string; children?: unknown[] }>) =>
    items.forEach((item) => {
      const segments = normalizePath(item.href)
      if (segments?.length && !out.has(toPath(segments))) out.set(toPath(segments), out.size + 1)
      walk((item.children ?? []) as Array<{ href: string; children?: unknown[] }>)
    })
  walk(menu)
  return out
}

function depthOf(page: WpPage, byId: Map<number, WpPage>): number {
  let depth = 0
  for (let p = byId.get(page.parent); p && depth < 20; p = byId.get(p.parent)) depth++
  return depth
}

/** WordPress page id → migrated page id. */
export async function migratePages(
  run: Run,
  pages: WpPage[],
  deps: PageDeps,
): Promise<Map<number, string>> {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const ids = new Map<number, string>()
  const firstWithText = new Map<string, number>()
  const ordered = [...pages].sort(
    (a, b) => depthOf(a, byId) - depthOf(b, byId) || a.menu_order - b.menu_order || a.id - b.id,
  )

  for (const page of ordered) {
    run.tally('page', 'source')
    const kind = deps.kinds.get(page.id)
    if (!kind || kind === 'demo') {
      run.tally('page', 'excluded')
      continue
    }
    const reject = (gate: 'A-source' | 'C-content' | 'validation', summary: string) =>
      run.issue({ entity: 'page', wpId: page.id, gate, severity: 'rejected', summary })
    if (page.parent && !ids.has(page.parent)) {
      reject('validation', 'parent page was not migrated, so its address cannot be built')
      continue
    }
    const gated = gatePage(page)
    if (!gated.ok) {
      reject(
        'A-source',
        `malicious-content indicators survived cleaning (${gated.iocs.join(', ')})`,
      )
      continue
    }
    const { model } = gated
    const notes = [...model.warnings]
    const resolved = await resolveMedia(
      deps.media,
      [model.body, ...model.sections.map((s) => s.html)],
      page.id,
    )
    const body = convert(model.body, `page:${page.id}`, resolved, deps)
    const sections = model.sections.map((s, i) => ({
      title: s.title,
      result: convert(s.html, `page:${page.id}:${i}`, resolved, deps),
    }))
    const dropped = [body, ...sections.map((s) => s.result)].map(droppedImagesNote).find(Boolean)
    if (dropped) notes.push(dropped)
    notes.push(...removedLinksNotes([body, ...sections.map((s) => s.result)]))

    const text = [model.body, ...model.sections.map((s) => s.html)].map(htmlToText).join(' ').trim()
    if (!text) notes.push('page has no text (it only listed its sub-pages)')
    else {
      const same = firstWithText.get(hashOf(text))
      if (same) notes.push(`same text as page #${same}: check which page it belongs to`)
      else firstWithText.set(hashOf(text), page.id)
    }

    const original = decodeSlug(page.slug)
    const slug = normalizeSlug(original)
    const path = deps.pagePaths.get(page.id)
    const data = {
      title: (htmlToText(page.title) || slug).slice(0, 300),
      kind,
      content:
        htmlToText(model.body) || /<img\b|<iframe\b/i.test(model.body) ? body.state : undefined,
      sections: sections.map((s) => ({ title: s.title, content: s.result.state })),
      featuredImage: await featuredImage(deps.media, page, notes),
      slug,
      parent: page.parent ? ids.get(page.parent) : null,
      order: (path && deps.menuOrder.get(path)) || 1000 + page.menu_order,
      flags: {
        needsReview: notes.length > 0,
        reviewNote: notes.join(' · ').slice(0, 1000) || undefined,
      },
      legacy: {
        wpId: page.id,
        legacySlugs: original !== slug ? [original] : [],
        legacyUrls: [page.link].filter(Boolean),
      },
    }
    try {
      const { id } = await upsert(
        run,
        'page',
        'pages',
        { 'legacy.wpId': { equals: page.id } },
        data,
      )
      ids.set(page.id, id)
    } catch (err) {
      reject('C-content', `refused by the CMS: ${(err as Error).message}`)
      continue
    }
    for (const note of notes)
      run.issue({
        entity: 'page',
        wpId: page.id,
        gate: 'validation',
        severity: 'warning',
        summary: note,
      })
  }
  return ids
}
