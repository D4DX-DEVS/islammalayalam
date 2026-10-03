// Guarded Playwright audit of the live site across mobile / tablet / desktop.
// Usage: node scripts/crawl.mjs [--only=key1,key2]
import { chromium, devices } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { installGuard, newGuardLog } from '../lib/guard.mjs';
import { collectPage, perfObserversInit } from '../lib/collect.mjs';
import { SITE, pool, writeJsonSafe } from '../lib/http.mjs';
import { defang } from '../lib/sanitize.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const load = async (f) => JSON.parse(await readFile(`${ROOT}data/wp/${f}.json`, 'utf8'));
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const VIEWPORTS = [
  { name: 'mobile', opts: { ...devices['iPhone 13'] } },
  { name: 'tablet', opts: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: 'desktop', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
];

async function buildTargets() {
  const [posts, pages, cats, tags] = await Promise.all([load('posts'), load('pages'), load('categories'), load('tags')]);
  const t = [];
  const add = (key, url, tpl, extra = {}) => t.push({ key, url: new URL(url, SITE).toString(), tpl, ...extra });
  add('home', '/', 'home', { fullPage: true, allVp: true });
  add('home-page-2', '/page/2/', 'home-paged');
  for (const c of cats.filter((c) => c.count > 0)) {
    add(`cat-${c.id}`, c.link, 'category', { allVp: c.id === 21, fullPage: c.id === 21 });
    if (c.count > 10) add(`cat-${c.id}-p2`, `${c.link}page/2/`, 'category-paged');
  }
  add('cat-empty-242', cats.find((c) => c.id === 242).link, 'category-empty');
  const topTag = [...tags].sort((a, b) => b.count - a.count)[0];
  add(`tag-${topTag.id}`, topTag.link, 'tag');
  add('author-editor', '/author/editor/', 'author');
  add('date-2022', '/2022/', 'date-archive');
  add('search-ml', `/?s=${encodeURIComponent('ഇസ്ലാം')}`, 'search', { allVp: true });
  add('search-none', '/?s=zzqxnothing', 'search-empty');
  add('404', '/this-page-should-404-xyz/', '404', { allVp: true });
  add('post-id-bad', '/99999999/', '404-post');

  const byId = new Map(posts.map((p) => [p.id, p]));
  const pick = (ids, tpl, note) => ids.filter((id) => byId.has(id)).forEach((id) => add(`post-${id}`, byId.get(id).link, tpl, { note }));
  pick([2407], 'post', 'largest infected (3 MB)');
  pick([2538, 2699, 3142], 'post', 'inline / external images');
  pick(posts.filter((p) => p.format === 'video').slice(0, 2).map((p) => p.id), 'post-video', 'video format');
  pick(posts.filter((p) => p.format === 'audio').slice(0, 2).map((p) => p.id), 'post-audio', 'audio format');
  pick(posts.filter((p) => p.format === 'link').map((p) => p.id), 'post-link', 'link format');
  pick([257, 10391], 'post-demo', 'demo post, featured media missing');
  pick([...posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2).map((p) => p.id), 'post', 'latest');
  pick(posts.filter((p) => p.date.startsWith('0020')).map((p) => p.id), 'post', 'bad date 0020');
  pick(posts.filter((p) => !p.featured_media).slice(0, 1).map((p) => p.id), 'post', 'no featured image');
  if (byId.has(2407)) t.find((x) => x.key === 'post-2407').allVp = true;

  const pg = new Map(pages.map((p) => [p.id, p]));
  const pickPage = (id, tpl, note, extra = {}) => pg.has(id) && add(`page-${id}`, pg.get(id).link, tpl, { note, ...extra });
  pickPage(1843, 'page', 'Home page (static)');
  pickPage(269, 'page', 'KB root ആദര്‍ശം (shortcodes)', { allVp: true });
  pickPage(296, 'page', 'KB deep child + spam link');
  pickPage(715, 'page', 'KB ചരിത്രം 37KB');
  pickPage(918, 'page', 'free-quran');
  pickPage(1691, 'page', 'quiz-2023');
  pickPage(814, 'page', 'postal');
  pickPage(5454, 'page', 'wp-file-download-search');
  pickPage(207, 'page-demo', 'theme demo: typography');
  pickPage(600, 'page-demo', 'theme demo: portfolio');
  pickPage(576, 'page-demo', 'theme demo: gallery');
  pickPage(220, 'page', 'about');
  pickPage(10282, 'page', 'contact (form?)');
  return only ? t.filter((x) => only.includes(x.key)) : t;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight && y < 40000; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    scrollTo(0, 0);
  }).catch(() => {});
}

async function testMobileMenu(page) {
  const opener = page.locator('.wp-block-navigation__responsive-container-open, button[aria-label*="menu" i], .menu-toggle').first();
  if (!(await opener.isVisible().catch(() => false))) return { found: false };
  await opener.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const panel = page.locator('.wp-block-navigation__responsive-container.is-menu-open, nav.toggled, [aria-expanded="true"] + *').first();
  const open = await panel.isVisible().catch(() => false);
  const links = open ? await panel.locator('a').evaluateAll((as) => as.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))) : [];
  await page.keyboard.press('Escape').catch(() => {});
  return { found: true, opens: open, links };
}

async function auditOne(context, vp, target) {
  const page = await context.newPage();
  const out = { key: target.key, vp: vp.name, tpl: target.tpl, note: target.note, requested: target.url };
  const consoleMsgs = [];
  const pageErrors = [];
  const net = { failed: [], httpErrors: [], images: [], slow: [] };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 300) }));
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => net.failed.push({ url: r.url(), type: r.resourceType(), failure: r.failure()?.errorText }));
  page.on('response', (r) => {
    const req = r.request();
    if (r.status() >= 400) net.httpErrors.push({ url: r.url(), status: r.status(), type: req.resourceType() });
    if (req.resourceType() === 'image') net.images.push({ url: r.url(), status: r.status(), ct: r.headers()['content-type'] || null });
  });
  page.on('requestfinished', (req) => {
    const ms = req.timing().responseEnd;
    if (ms > 2000) net.slow.push({ url: req.url(), type: req.resourceType(), ms: Math.round(ms) });
  });

  const t0 = Date.now();
  try {
    const resp = await page.goto(target.url, { waitUntil: 'load', timeout: 120_000 });
    out.status = resp?.status() ?? null;
    const chain = [];
    for (let r = resp?.request().redirectedFrom(); r; r = r.redirectedFrom()) chain.unshift(r.url());
    out.redirects = chain;
  } catch (e) {
    out.navError = e.message.slice(0, 300);
  }
  out.loadMs = Date.now() - t0;
  await autoScroll(page);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  out.data = await page.evaluate(collectPage).catch((e) => ({ evalError: e.message }));
  if (vp.name === 'mobile') out.mobileMenu = await testMobileMenu(page);
  const shot = `${ROOT}screens/${vp.name}/${target.key}.png`;
  await page.screenshot({ path: shot, fullPage: !!target.fullPage, scale: 'css', timeout: 30_000 }).catch(() => {});
  out.console = consoleMsgs.slice(0, 40);
  out.pageErrors = pageErrors.slice(0, 20);
  out.net = { ...net, images: net.images.filter((i) => i.status >= 400 || !/^image\//.test(i.ct || '')), imageCount: net.images.length };
  await page.close();
  return out;
}

const targets = await buildTargets();
console.log(`targets: ${targets.length}`);
const browser = await chromium.launch({ headless: true });
const results = [];
const guards = {};
await Promise.all(VIEWPORTS.map(async (vp) => {
  await mkdir(`${ROOT}screens/${vp.name}`, { recursive: true });
  const context = await browser.newContext({ ...vp.opts, acceptDownloads: false, serviceWorkers: 'block', locale: 'ml-IN' });
  const log = newGuardLog();
  guards[vp.name] = log;
  await installGuard(context, log);
  await context.addInitScript(perfObserversInit);
  const mine = targets.filter((t) => vp.name !== 'tablet' || t.allVp);
  await pool(mine, 2, async (t) => {
    const r = await auditOne(context, vp, t);
    results.push(r);
    const d = r.data || {};
    console.log(`[${vp.name}] ${t.key} ${r.status ?? r.navError} ${r.loadMs}ms imgs=${d.images?.total ?? '?'} broken=${d.images?.broken?.length ?? '?'} errs=${r.pageErrors.length}`);
  });
  await context.close();
}));
await browser.close();
const outName = only ? 'crawl-partial.json' : 'crawl.json';
const payload = JSON.parse(defang(JSON.stringify({ at: new Date().toISOString(), results, guards })));
await writeJsonSafe(`${ROOT}data/${outName}`, payload);
console.log('done');
