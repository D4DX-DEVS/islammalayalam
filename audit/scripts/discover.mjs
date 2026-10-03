// Static discovery: fetch key documents via Node (never a browser), sanitize, persist clean copies,
// and extract theme/plugins/hosts/menus/sitemaps. Usage: node scripts/discover.mjs
import { fileURLToPath } from 'node:url';
import { SITE, fetchText, writeJsonSafe } from '../lib/http.mjs';
import { sanitize, assertClean } from '../lib/sanitize.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
await mkdir(`${DATA}html`, { recursive: true });

async function getClean(path, file) {
  const res = await fetchText(SITE + path);
  const s = sanitize(res.text);
  if (s.residualIocs.length) throw new Error(`${path}: residual IOCs ${s.residualIocs}`);
  if (file) await writeFile(`${DATA}html/${file}`, assertClean(s.clean, file), 'utf8');
  return { status: res.status, finalUrl: res.url, headers: res.headers, html: s.clean, removed: s.removed, rawBytes: res.text.length };
}

const uniq = (a) => [...new Set(a)];
const home = await getClean('/', 'home.html');
const h = home.html;
const attrs = (re) => uniq([...h.matchAll(re)].map((m) => m[1]));
const scripts = attrs(/<script[^>]+src=["']([^"']+)["']/gi);
const styles = attrs(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
const hosts = uniq([...scripts, ...styles, ...attrs(/<(?:img|iframe|source)[^>]+src=["']([^"']+)["']/gi)]
  .map((u) => { try { return new URL(u, SITE).host; } catch { return null; } }).filter(Boolean));
const plugins = uniq([...h.matchAll(/wp-content\/plugins\/([^/'"?]+)/g)].map((m) => m[1]));
const themes = uniq([...h.matchAll(/wp-content\/themes\/([^/'"?]+)/g)].map((m) => m[1]));
const menus = [...h.matchAll(/<ul[^>]+id=["']([^"']*menu[^"']*)["'][^>]*>([\s\S]*?)<\/ul>\s*<\/(?:nav|div)>/gi)].map((m) => ({
  id: m[1],
  links: [...m[2].matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((x) => ({ href: x[1], text: x[2].replace(/<[^>]+>/g, '').trim() })),
}));
const internalLinks = uniq(attrs(/<a[^>]+href=["']([^"'#]+)["']/gi).filter((u) => u.startsWith(SITE) || u.startsWith('/')));
const meta = {
  title: h.match(/<title>([\s\S]*?)<\/title>/i)?.[1],
  generator: attrs(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi),
  canonical: h.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null,
  description: h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? null,
  og: [...h.matchAll(/<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)["']/gi)].map((m) => [m[1], m[2]]),
  jsonLdBlocks: (h.match(/application\/ld\+json/g) || []).length,
  lang: h.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1],
  viewport: h.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i)?.[1],
};

const extras = {};
for (const [path, file] of [['/wp-sitemap.xml', 'wp-sitemap.xml'], ['/feed/', 'feed.xml'], ['/sitemap_index.xml', null], ['/ads.txt', null], ['/this-page-should-404-xyz/', null], ['/?s=%E0%B4%87%E0%B4%B8%E0%B5%8D%E0%B4%B2%E0%B4%BE%E0%B4%82', null], ['/wp-login.php', null], ['/xmlrpc.php', null], ['/readme.html', null], ['/wp-content/uploads/', null], ['/?author=1', null]]) {
  try {
    const r = await getClean(path, file);
    extras[path] = { status: r.status, finalUrl: r.finalUrl, bytes: r.html.length, removed: r.removed, contentType: r.headers['content-type'], title: r.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? null };
  } catch (e) { extras[path] = { error: e.message }; }
}

await writeJsonSafe(`${DATA}discovery.json`, {
  home: { status: home.status, rawBytes: home.rawBytes, cleanBytes: h.length, removed: home.removed, headers: home.headers },
  meta, themes, plugins, hosts, scripts, styles, menus, internalLinkCount: internalLinks.length, internalLinks, extras,
});
console.log(JSON.stringify({ meta, themes, plugins, hosts, menus: menus.map((m) => ({ id: m.id, n: m.links.length })), extras, removed: home.removed, rawBytes: home.rawBytes }, null, 1));
