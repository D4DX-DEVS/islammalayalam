// Dump public WordPress REST data (sanitized) + per-item infection stats.
// Usage: node scripts/dump-wp.mjs
import { SITE, fetchText, writeJsonSafe, pool } from '../lib/http.mjs';
import { parseWpJson, sanitize, sanitizeContent, findIocs } from '../lib/sanitize.mjs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../data/wp/', import.meta.url));
const COLLECTIONS = [
  { name: 'posts', perPage: 5, rich: true },
  { name: 'pages', perPage: 5, rich: true },
  { name: 'categories', perPage: 100 },
  { name: 'tags', perPage: 100 },
  { name: 'media', perPage: 100 },
  { name: 'users', perPage: 100 },
];

function deepSanitize(value, stats) {
  if (typeof value === 'string') {
    const r = sanitize(value);
    if (r.bytesRemoved) stats.stringsCleaned += 1;
    return r.clean;
  }
  if (Array.isArray(value)) return value.map((v) => deepSanitize(v, stats));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepSanitize(v, stats)]));
  }
  return value;
}

function extractRefs(html) {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const tag = m[0];
    const attr = (n) => tag.match(new RegExp(`\\s${n}=["']([^"']*)["']`, 'i'))?.[1] ?? null;
    return { src: attr('src'), dataSrc: attr('data-src') || attr('data-lazy-src'), srcset: attr('srcset'), alt: attr('alt'), cls: attr('class') };
  });
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const iframes = [...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const media = [...html.matchAll(/<(?:audio|video|source)\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const shortcodes = [...new Set([...html.matchAll(/\[([a-z_][a-z0-9_-]*)[\s\]]/gi)].map((m) => m[1]))];
  const blocks = [...new Set([...html.matchAll(/<!-- wp:([a-z0-9/-]+)/gi)].map((m) => m[1]))];
  return { imgs, links, iframes, media, shortcodes, blocks };
}

function richItem(raw, infection) {
  const content = sanitizeContent(raw.content?.rendered ?? '');
  const excerpt = sanitizeContent(raw.excerpt?.rendered ?? '');
  const title = sanitize(raw.title?.rendered ?? '');
  infection.push({
    id: raw.id,
    type: raw.type,
    link: raw.link,
    rawBytes: (raw.content?.rendered ?? '').length,
    cleanBytes: content.clean.length,
    removed: content.removed,
    excerptRemoved: excerpt.removed,
    titleInfected: title.bytesRemoved > 0,
    residualIocs: [...content.residualIocs, ...excerpt.residualIocs],
    unknownScriptHeads: content.unknownScriptHeads,
  });
  const stats = { stringsCleaned: 0 };
  const rest = deepSanitize({ ...raw, content: undefined, excerpt: undefined, title: undefined }, stats);
  return {
    ...rest,
    title: title.clean,
    content: content.residualIocs.length ? '[REDACTED: residual IOC]' : content.clean,
    excerpt: excerpt.residualIocs.length ? '[REDACTED: residual IOC]' : excerpt.clean,
    refs: extractRefs(content.clean),
    _keys: Object.keys(raw),
  };
}

async function getPage(name, perPage, page) {
  const url = `${SITE}/wp-json/wp/v2/${name}?per_page=${perPage}&page=${page}&orderby=id&order=asc`;
  const res = await fetchText(url, { timeoutMs: 300_000 });
  if (res.status !== 200) throw new Error(`${url} -> ${res.status}`);
  return { res, items: parseWpJson(res.text) };
}

async function dumpCollection({ name, perPage, rich }) {
  const first = await getPage(name, perPage, 1);
  const total = Number(first.res.headers['x-wp-total']);
  const totalPages = Number(first.res.headers['x-wp-totalpages']);
  const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await pool(pages, rich ? 3 : 4, async (p) => (await getPage(name, perPage, p)).items);
  const all = [first.items, ...rest].flat();
  const infection = [];
  const stats = { stringsCleaned: 0 };
  const items = all.map((raw) => (rich ? richItem(raw, infection) : deepSanitize(raw, stats)));
  await writeJsonSafe(`${OUT}${name}.json`, items);
  if (rich) await writeJsonSafe(`${OUT}${name}.infection.json`, infection);
  console.log(`${name}: header total=${total}, fetched=${all.length}, unique ids=${new Set(all.map((x) => x.id)).size}`);
  return { name, total, fetched: all.length };
}

async function dumpMeta() {
  for (const [file, path] of [['root', '/wp-json/'], ['types', '/wp-json/wp/v2/types'], ['taxonomies', '/wp-json/wp/v2/taxonomies']]) {
    const res = await fetchText(SITE + path);
    const trailerIocs = findIocs(res.text);
    const json = parseWpJson(res.text);
    const stats = { stringsCleaned: 0 };
    const data = file === 'root'
      ? { name: json.name, description: json.description, url: json.url, home: json.home, gmt_offset: json.gmt_offset, timezone_string: json.timezone_string, namespaces: json.namespaces, authentication: json.authentication, site_logo: json.site_logo, site_icon: json.site_icon, site_icon_url: json.site_icon_url, routes: Object.keys(json.routes) }
      : deepSanitize(json, stats);
    await writeJsonSafe(`${OUT}${file}.json`, { _responseHadIocs: trailerIocs, ...data });
  }
}

const started = Date.now();
await dumpMeta();
const summary = [];
for (const c of COLLECTIONS) summary.push(await dumpCollection(c));
await writeJsonSafe(`${OUT}summary.json`, { at: new Date().toISOString(), seconds: (Date.now() - started) / 1000, summary });
console.log('done in', ((Date.now() - started) / 1000).toFixed(1), 's');
