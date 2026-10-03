// Capture the ORIGINAL (pre-incident) design from the Wayback Machine.
// JavaScript is disabled entirely => no archived script can execute. Only web.archive.org is reachable.
// Usage: node scripts/archive-shots.mjs
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchText, writeJsonSafe } from '../lib/http.mjs';
import { sanitize } from '../lib/sanitize.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TS = '20260416073318';
const PAGES = [
  { key: 'home', path: '/' },
  { key: 'category-news', path: '/category/news/' },
  { key: 'post-4306', path: '/4306/' },
  { key: 'kb-page', path: '/%E0%B4%86%E0%B4%A6%E0%B4%B0%E0%B5%8D%E2%80%8D%E0%B4%B6%E0%B4%82/' },
];
const strip = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const shotsOnly = process.argv.includes('--shots-only');

// 1) Full original menu tree from the raw archived HTML (Node only, sanitized in memory)
if (!shotsOnly) await extractIa();
async function extractIa() {
const raw =(await fetchText(`https://web.archive.org/web/${TS}id_/https://islammalayalam.net/`, { timeoutMs: 180_000 })).text;
const h = sanitize(raw).clean;
const navStart = h.indexOf('id="menu-');
const navHtml = h.slice(navStart, h.indexOf('</nav>', navStart));
const menu = [];
const stack = [{ children: menu }];
for (const tok of navHtml.matchAll(/<li\b[^>]*>|<\/li>|<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<ul\b[^>]*>|<\/ul>/g)) {
  const t = tok[0];
  if (t.startsWith('<li')) {
    const item = { title: null, href: null, children: [] };
    stack.at(-1).children.push(item);
    stack.push(item);
  } else if (t === '</li>') stack.pop();
  else if (t.startsWith('<a') && stack.length > 1 && !stack.at(-1).title) {
    stack.at(-1).title = strip(tok[2]);
    stack.at(-1).href = decodeURIComponent(tok[1].replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, '')).replace(/^https?:\/\/islammalayalam\.net/, '');
  }
}
const topbar = [...h.matchAll(/penci-topbar-menu[\s\S]*?<\/ul>/g)].map((m) => [...m[0].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((x) => ({ title: strip(x[2]), href: x[1] })));
const footerLinks = [...h.slice(h.lastIndexOf('<footer')).matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((x) => ({ title: strip(x[2]), href: x[1].replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, '') }));
await writeJsonSafe(`${ROOT}data/original-ia.json`, { snapshot: TS, menu, topbar, footerLinks });
const count = (items) => items.reduce((n, i) => n + 1 + count(i.children), 0);
console.log(`menu: ${menu.length} top-level, ${count(menu)} total | topbar groups: ${topbar.length} | footer links: ${footerLinks.length}`);
for (const m of menu) console.log(`  ${m.title} (${count(m.children)})`);
}

// 2) Screenshots with JS disabled
const browser = await chromium.launch({ headless: true });
for (const vp of [{ name: 'mobile', opts: devices['iPhone 13'] }, { name: 'desktop', opts: { viewport: { width: 1440, height: 900 } } }]) {
  await mkdir(`${ROOT}screens/original/${vp.name}`, { recursive: true });
  const ctx = await browser.newContext({ ...vp.opts, javaScriptEnabled: false, acceptDownloads: false, serviceWorkers: 'block' });
  // NOTE: with javaScriptEnabled:false, page.evaluate/addStyleTag never resolve — so all page tweaks happen here.
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname !== 'web.archive.org') return route.abort('blockedbyclient');
    if (req.resourceType() !== 'document') return route.continue();
    const resp = await route.fetch({ timeout: 120_000 }).catch(() => null);
    if (!resp) return route.abort('failed');
    const hide = '<style>#wm-ipp-base,#wm-ipp,#donato,#wm-ipp-print{display:none!important}</style>';
    const body = sanitize(await resp.text()).clean.replace(/<\/head>/i, `${hide}</head>`);
    const headers = { ...resp.headers() };
    delete headers['content-length'];
    delete headers['content-encoding'];
    return route.fulfill({ status: resp.status(), headers, body });
  });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    try {
      await page.goto(`https://web.archive.org/web/${TS}/https://islammalayalam.net${p.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
      await page.screenshot({ path: `${ROOT}screens/original/${vp.name}/${p.key}.png`, fullPage: true, scale: 'css', timeout: 60_000 });
      console.log(`[${vp.name}] ${p.key} -> ${page.url().slice(0, 100)}`);
    } catch (e) {
      console.log(`[${vp.name}] ${p.key} FAILED ${e.message.slice(0, 120)}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
