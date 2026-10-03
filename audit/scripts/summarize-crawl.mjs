// Aggregate data/crawl.json into a compact findings table. Usage: node scripts/summarize-crawl.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { writeJsonSafe } from '../lib/http.mjs';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const { results, guards } = JSON.parse(await readFile(`${DATA}crawl.json`, 'utf8'));
const AUDIT_NOISE = /Content Security Policy|ERR_BLOCKED_BY_CLIENT|cloudflareinsights/i;

const rows = results
  .sort((a, b) => a.key.localeCompare(b.key) || a.vp.localeCompare(b.vp))
  .map((r) => {
    const d = r.data || {};
    return {
      key: r.key,
      vp: r.vp,
      tpl: r.tpl,
      status: r.status ?? r.navError,
      redirects: r.redirects?.length || 0,
      loadMs: r.loadMs,
      ttfb: d.perf?.ttfb,
      htmlKB: d.perf?.htmlKB,
      dom: d.perf?.domNodes,
      lcp: d.perf?.lcp,
      lcpEl: d.perf?.lcpEl,
      cls: d.perf?.cls,
      imgs: d.images?.total,
      broken: (d.images?.broken || []).map((i) => i.attrSrc || i.dataSrc),
      noAlt: d.images?.noAlt,
      noDims: d.images?.noDims,
      httpErrors: (r.net?.httpErrors || []).map((e) => `${e.status} ${e.type} ${e.url}`),
      failed: (r.net?.failed || []).filter((f) => !/BLOCKED_BY_CLIENT/.test(f.failure || '')).map((f) => `${f.failure} ${f.type} ${f.url}`),
      slow: (r.net?.slow || []).map((s) => `${s.ms}ms ${s.type} ${s.url}`),
      consoleErrors: (r.console || []).filter((c) => c.type === 'error' && !AUDIT_NOISE.test(c.text)).map((c) => c.text),
      pageErrors: r.pageErrors,
      title: d.title,
      lang: d.lang,
      desc: !!d.seo?.description,
      canonical: d.seo?.canonical,
      robots: d.seo?.robots,
      og: Object.keys(d.seo?.og || {}).length,
      twitter: Object.keys(d.seo?.twitter || {}).length,
      jsonLd: d.seo?.jsonLd,
      h1: d.seo?.h1,
      headings: d.seo?.headings,
      breadcrumbs: d.seo?.breadcrumbs,
      prevNext: [d.seo?.prev, d.seo?.next].filter(Boolean).length,
      overflow: d.layout?.horizontalOverflow,
      overflowing: d.layout?.overflowing,
      smallTargets: d.layout?.smallTargets,
      hashLinks: d.links?.hashOnly,
      emptyLinks: d.links?.emptyText,
      rawShortcodes: d.rawShortcodes,
      menu: r.mobileMenu,
      a11y: d.a11y,
    };
  });

const guardSummary = Object.fromEntries(Object.entries(guards).map(([vp, g]) => {
  const removed = {};
  for (const s of g.sanitized) for (const [k, v] of Object.entries(s.removed)) removed[k] = (removed[k] || 0) + v;
  const blocked = {};
  for (const b of g.blocked) {
    const k = `${b.reason} ${b.type} ${b.url.replace(/^(https?:\/\/[^/]+).*/, '$1')}`;
    blocked[k] = (blocked[k] || 0) + 1;
  }
  return [vp, { sanitizedDocs: g.sanitized.length, removed, blocked, guardErrors: g.guardErrors.length }];
}));

await writeJsonSafe(`${DATA}crawl-summary.json`, { guardSummary, rows });
console.log(JSON.stringify(guardSummary, null, 1));
for (const r of rows) {
  const flags = [
    r.broken.length && `broken=${r.broken.length}`,
    r.httpErrors.length && `http=${r.httpErrors.length}`,
    r.failed.length && `failed=${r.failed.length}`,
    r.consoleErrors.length && `console=${r.consoleErrors.length}`,
    r.pageErrors?.length && `jsErr=${r.pageErrors.length}`,
    r.overflow && 'H-OVERFLOW',
    r.rawShortcodes?.length && 'SHORTCODES',
    r.slow.length && `slow=${r.slow.length}`,
  ].filter(Boolean).join(' ');
  console.log(`${r.vp.padEnd(7)} ${r.key.padEnd(18)} ${String(r.status).padEnd(4)} load=${r.loadMs} ttfb=${r.ttfb} html=${r.htmlKB}KB dom=${r.dom} lcp=${r.lcp} cls=${r.cls} imgs=${r.imgs} h1=${r.h1?.length} desc=${r.desc} og=${r.og} ld=${r.jsonLd?.length} small=${r.smallTargets} ${flags}`);
}
