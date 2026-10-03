// Enumerate /wp-content/uploads/ via the (misconfigured, publicly enabled) Apache directory index.
// Reads listing pages only; never downloads files. Usage: node scripts/list-uploads.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SITE, fetchText, writeJsonSafe } from '../lib/http.mjs';
import { sanitize } from '../lib/sanitize.mjs';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const BASE = `${SITE}/wp-content/uploads/`;
const files = [];
const dirs = [];
const queue = [BASE];
const seen = new Set();

while (queue.length) {
  const batch = queue.splice(0, 4);
  await Promise.all(batch.map(async (dir) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    const res = await fetchText(dir).catch((e) => ({ status: 0, text: '', error: e.message }));
    if (res.status !== 200 || !/Index of/i.test(res.text)) {
      dirs.push({ dir, status: res.status, listing: false });
      return;
    }
    const html = sanitize(res.text).clean;
    dirs.push({ dir, status: 200, listing: true });
    for (const m of html.matchAll(/<a href="([^"?][^"]*)">[^<]*<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>/gi)) {
      const href = m[1];
      if (href.startsWith('/') || href === '../') continue;
      const url = new URL(href, dir).toString();
      if (href.endsWith('/')) queue.push(url);
      else files.push({ url, modified: m[2].trim(), size: m[3].trim() });
    }
  }));
}

const media = JSON.parse(await readFile(`${DATA}wp/media.json`, 'utf8'));
const known = new Set();
for (const m of media) {
  known.add(m.source_url);
  for (const s of Object.values(m.media_details?.sizes || {})) known.add(s.source_url);
}
const ext = (u) => (u.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const isVariant = (u) => /-\d+x\d+\.[a-z0-9]+$/i.test(u) || /-scaled\.[a-z0-9]+$/i.test(u);
const byExt = {};
for (const f of files) byExt[ext(f.url)] = (byExt[ext(f.url)] || 0) + 1;
const originals = files.filter((f) => !isVariant(f.url));
const orphanOriginals = originals.filter((f) => !known.has(f.url) && /^(jpe?g|png|gif|webp|pdf|mp3|mp4|m4a|svg|woff2?)$/.test(ext(f.url)));
const suspicious = files.filter((f) => /\.(php\d?|phtml|phar|js|html?|htaccess|sh|py|exe|zip)$/i.test(f.url) || /\.(php|phtml)\./i.test(f.url));
const topDirs = {};
for (const f of files) {
  const k = f.url.replace(BASE, '').split('/').slice(0, 1)[0];
  topDirs[k] = (topDirs[k] || 0) + 1;
}

const summary = {
  directories: dirs.length,
  listingDisabledDirs: dirs.filter((d) => !d.listing).length,
  files: files.length,
  byExt,
  topLevel: topDirs,
  originals: originals.length,
  variants: files.length - originals.length,
  orphanOriginals: orphanOriginals.length,
  suspicious: suspicious.length,
};
await writeJsonSafe(`${DATA}uploads-listing.json`, { summary, suspicious, orphanOriginals, dirs, files });
console.log(JSON.stringify(summary, null, 2));
console.log('SUSPICIOUS:', suspicious.slice(0, 40).map((f) => `${f.url.replace(BASE, '')} (${f.size}, ${f.modified})`).join('\n  '));
