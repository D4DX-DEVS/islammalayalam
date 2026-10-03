// Verify every media URL WordPress generates (originals, size variants, inline <img>, featured refs).
// Range-GETs 1KB per URL, records status / redirect chain / content-type / magic bytes.
// Usage: node scripts/check-media.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SITE, probe, fetchText, pool, writeJsonSafe } from '../lib/http.mjs';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const load = async (f) => JSON.parse(await readFile(`${DATA}wp/${f}.json`, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probeWithBackoff(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await probe(url);
    const s = r.final?.status;
    if (s !== 429 && s !== 503 && !r.final?.error) return r;
    await sleep(2000 * 2 ** attempt);
  }
  return probe(url);
}

const [media, posts, pages] = await Promise.all([load('media'), load('posts'), load('pages')]);
const targets = new Map(); // url -> { kinds:Set, refs:Set }
const add = (url, kind, ref) => {
  if (!url) return;
  const abs = new URL(url, SITE).toString();
  if (!targets.has(abs)) targets.set(abs, { kinds: new Set(), refs: new Set() });
  targets.get(abs).kinds.add(kind);
  if (ref) targets.get(abs).refs.add(ref);
};

for (const m of media) {
  add(m.source_url, 'original', `media:${m.id}`);
  for (const [size, s] of Object.entries(m.media_details?.sizes || {})) add(s.source_url, `size:${size}`, `media:${m.id}`);
}
for (const p of [...posts, ...pages]) {
  for (const img of p.refs.imgs) {
    add(img.src, 'inline', `${p.type}:${p.id}`);
    if (img.dataSrc) add(img.dataSrc, 'inline-lazy', `${p.type}:${p.id}`);
    for (const cand of (img.srcset || '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)) {
      add(cand, 'inline-srcset', `${p.type}:${p.id}`);
    }
  }
}

const urls = [...targets.keys()];
console.log(`probing ${urls.length} unique URLs...`);
let done = 0;
const results = await pool(urls, 10, async (url) => {
  const r = await probeWithBackoff(url);
  if (++done % 500 === 0) console.log(`  ${done}/${urls.length}`);
  const t = targets.get(url);
  return { url, ok: r.ok, kinds: [...t.kinds], refs: [...t.refs].slice(0, 10), chain: r.chain, final: r.final };
});

// Featured media ids that the public media listing did not return
const mediaIds = new Set(media.map((m) => m.id));
const missingFeatured = [...new Set(posts.map((p) => p.featured_media).filter((id) => id && !mediaIds.has(id)))];
const featuredChecks = await pool(missingFeatured, 5, async (id) => {
  const r = await fetchText(`${SITE}/wp-json/wp/v2/media/${id}?_fields=id,source_url,status`);
  let body = null;
  try { body = JSON.parse(r.text.slice(0, r.text.indexOf('<!--') > 0 ? r.text.indexOf('<!--') : undefined)); } catch { /* ignore */ }
  return { id, status: r.status, code: body?.code ?? null, usedBy: posts.filter((p) => p.featured_media === id).map((p) => p.id) };
});

const failed = results.filter((r) => !r.ok);
const byStatus = {};
for (const r of failed) {
  const key = `${r.final?.status ?? r.final?.error ?? 'err'} ${new URL(r.url).host}`;
  byStatus[key] = (byStatus[key] || 0) + 1;
}
const summary = {
  at: new Date().toISOString(),
  probed: results.length,
  ok: results.length - failed.length,
  failed: failed.length,
  failedByStatusHost: byStatus,
  redirected: results.filter((r) => r.chain.length > 1).length,
  htmlServedAsImage: results.filter((r) => r.final?.magic === 'html').length,
  contentTypeMismatch: results.filter((r) => r.ok && r.final?.contentType?.startsWith('image/') && !['jpeg', 'png', 'gif', 'webp', 'isobmff', 'svg/xml'].includes(r.final.magic)).length,
  missingFeatured: featuredChecks,
};
await writeJsonSafe(`${DATA}media-check.json`, { summary, failed, all: results });
console.log(JSON.stringify(summary, null, 2));
