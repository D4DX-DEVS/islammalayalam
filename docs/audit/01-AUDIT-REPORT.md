# IslamMalayalam.net — Phase 1 Discovery & Audit Report

**Audit date:** 2026-09-29 · **Target:** https://islammalayalam.net (WordPress 7.1.2) · **Status:** Discovery complete, rebuild NOT started

---

## 0. Executive summary

| # | Finding | Severity |
|---|---|---|
| 1 | **The live site is compromised and is actively serving malware (ClickFix / EtherHiding) to every visitor.** Windows Defender flagged the homepage as `Trojan:JS/ClickFix.ZYX!MTB`. | **CRITICAL — act now** |
| 2 | 489 of 513 posts (95.3 %) have malware **stored in `post_content`** (4,556 injected blocks; 83 % of all post bytes are malware). Every PHP response (HTML, REST JSON, RSS, robots.txt) also gets a malicious trailer + a `data:` URI script. | CRITICAL |
| 3 | The site's theme was switched (Soledad + WPBakery → `wens-magazine` block theme) sometime between **2026-04-16** and now. The homepage shows the theme's **demo template** (fake nav "Tech/Lifestyle/Business/Politics", "ADS BANNER", demo footer). 107 knowledge-base pages now print **raw `[vc_row]` shortcodes**. | HIGH |
| 4 | **"Images not loading" is NOT a WordPress media-storage fault.** All 6,303 site-hosted media URLs return 200 with correct bytes. The grey/empty cards come from (a) 79 posts with no usable featured image, (b) 10 posts whose dates were rewritten to 2026-07-02 so they float to the top of the homepage, (c) the demo theme template, and (d) 36 hotlinked images on dead third-party hosts. | HIGH |
| 5 | Data integrity damage: 10 posts had their publish date rewritten to **2026-07-02**; 94 posts have **empty titles**; 24 posts reference **deleted** featured images; 1 post is dated year `0020`. | HIGH |
| 6 | ~35 demo pages, 24 demo posts, 80 demo "portfolio" items, 13 demo categories and 3 demo tags are published and in the sitemap. | MEDIUM |
| 7 | SEO baseline is weak: no meta descriptions, no Open Graph, no JSON-LD, `lang="en-US"` on Malayalam content, no archive canonicals, no rel prev/next; one real category (കാഴ്ചപ്പാട്‌, 48 posts) is **unreachable (404)**. | MEDIUM |
| 8 | Performance: 1.2–2.5 s TTFB on every page (a `PHPSESSID` cookie on every response disables caching); infected posts ship up to **3.2 MB of HTML** (10–13 s load). | MEDIUM |

**Recommendation:** treat this as a security incident first and a migration second. The migration itself is the cleanest way out: the new Next.js site is built from **sanitized** data and never runs any WordPress PHP. But visitors are being attacked today, so containment (Section 1.6) should happen before the rebuild finishes.

---

## 1. Security incident (read first)

### 1.1 What is injected

| Layer | Where | Mechanism |
|---|---|---|
| A. Output trailer | Appended to **every** PHP response (HTML, `/wp-json/*`, `/feed/`, virtual `robots.txt`) | Two blocks `<!-- BEGIN: X Secure Pixel Stream -->` / `X-Advanced Pixel Stream`: XOR-obfuscated JS → `eth_call` to a **Polygon** smart contract → gets the current C2 domain → injects `<C2>/api.php?s=…` |
| B. Enqueued data-URI script | `<script id="_ea_s" src="data:text/javascript;base64,…">` on every page | `eth_call` to a **BNB-testnet** contract → `eval(atob(result))` (payload stored on-chain) |
| C. Stored in DB | `post_content` of 489 posts | Leaked PHP hook source (`function xdav_tracker(){…} add_action('wp_head',…,96)` / `'shutdown',…,97`), loader stubs (`document.createElement('script')` → remote C2), two more obfuscated variants |

Also: **spam SEO links** (essay-writing sites) in pages 296 and 627 — likely an earlier, separate compromise.

**Timeline (from `modified` timestamps):** 487 posts rewritten on **2026-09-18**, 2 more on **2026-09-28** (re-infection is ongoing). The Wayback snapshot of **2026-04-16** is clean.

### 1.2 Indicators of compromise (defanged)

| Type | Value |
|---|---|
| Polygon contract | `0x0C7Cb01C83203aC0a50Abc3a9AFF3c9Ca727eF55` (selector `0xb68d1809`) |
| BNB-testnet contract | `0xA1decFB75C8C0CA28C10517ce56B710baf727d2e` (selector `0x6d4ce63c`) |
| RPC used | `bsc-testnet-rpc[.]publicnode[.]com`, public Polygon RPCs (ankr, drpc, 1rpc, tenderly, publicnode, blastapi, quiknode, nodies) |
| C2 / loader hosts | `interseq[.]at` (`/lom/api`, `/lom2/api`), `securityalertcaptchacheck[.]com` (`/lom/api`) |
| C2 path | `/api.php?s=bfa8d66687ce0fd20ad81e377f3d0a63841b42231a0c7f95` |
| PHP | `function xdav_tracker` hooked on `wp_head` (priority 96) and `shutdown` (97) |
| HTML markers | `X Secure Pixel Stream`, `X-Advanced Pixel Stream`, `window.XTracker_TYKW`, `window.XTracker_JRKO`, `script#_ea_s` |
| AV verdict | Microsoft Defender: `Trojan:JS/ClickFix.ZYX!MTB` |

"ClickFix" = a fake "verify you are human" CAPTCHA that tells the visitor to paste a command into Win+R / PowerShell, which installs an info-stealer. Visitors on Windows are the main target.

### 1.3 Other security weaknesses observed (no intrusive testing was done)

- No security headers (no HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- `PHPSESSID` cookie on every page, without `Secure` / `HttpOnly` / `SameSite`.
- Directory listing enabled on `/wp-content/uploads/`; `readme.html` exposed (version disclosure).
- User enumeration: `/?author=1` → `/author/admin/`, `/wp-json/wp/v2/users` public; usernames are literally `admin` and `editor`.
- Leftover/abandoned plugins in use or on disk: Soledad `penci-*` plugins, WPBakery (`js_composer`) remnants, `form-maker` upload folder (Form Maker has a history of CVEs), WP File Download.
- The **Novamira** plugin exposes powerful endpoints (`/novamira/v1/admin-access/*`, `/upload`, `/chat/tools/execute`, MCP servers). These are legitimate features of that plugin, but on a compromised site they are high-value targets. Verify who installed it and restrict access.

### 1.4 What we did NOT find

- Theme/plugin **static JS files** enqueued on the homepage are clean (19 files scanned).
- No PHP or scripts inside `/wp-content/uploads/` (9,717 files listed).
- Media files themselves are clean images/PDFs (magic bytes verified).

### 1.5 Audit safety (how this audit protected this machine)

No payload was ever executed. All site responses were fetched by Node, sanitized **in memory**, IOC-scanned (fail-closed) and only then written to disk. The browser audit ran behind five layers: in-memory sanitization of every same-site document/script/JSON, a default-deny network allowlist, hard-blocked IOC hosts, an injected CSP without `unsafe-eval` / `data:` scripts and with `connect-src 'self'`, and neutered clipboard APIs. During the first smoke test, the guard caught and blocked a live RPC call from the then-unknown data-URI variant; the sanitizer was extended and the CSP layer added before the full crawl. Final crawl: **0 outbound malicious requests**. All files under `audit/data/` re-scanned: **0 IOCs**. Raw malicious files downloaded before the guard existed were deleted (Defender had already blocked one).

After an independent code review, the sanitizer and guard were hardened: case- and attribute-insensitive rules, matches bounded to a single script element (so a malformed payload can never swallow article text), `data:`/`blob:` documents blocked, `form-action 'none'`, popups and clipboard neutered at prototype level, exact-host allowlist. A 12-case `node:test` suite covers every variant (`audit/test/`). Regression on real data: identical removal counts and **byte-identical** sanitized content before and after hardening.

### 1.6 Recommended containment (owner / hosting action — not done by us)

1. **Immediately:** put a Cloudflare Worker (HTMLRewriter) in front of the site that strips `script#_ea_s`, the `Pixel Stream` blocks and inline `xdav_tracker`/loader scripts — this protects visitors within hours while the origin is cleaned. (We can write this Worker; deploying it is your decision.)
2. Take a full server + DB backup (evidence), then find and remove the persistence: `xdav_tracker` (check active theme `functions.php`, `wp-content/mu-plugins/`, `wp_options` autoloaded values, recently modified PHP files), and whatever enqueues `_ea_s`.
3. Rotate **all** credentials: WP users (reset `admin`/`editor`, remove unknown users), DB password, hosting panel, SFTP/SSH, Cloudflare, salts in `wp-config.php`, any API keys; revoke Novamira OAuth clients.
4. Update or remove every plugin; delete unused ones (Form Maker, penci-*, WPBakery leftovers); `DISALLOW_FILE_EDIT`; disable directory listing; remove `readme.html`.
5. Check Google Search Console → Security issues, and Google Safe Browsing status; request review after cleanup.

---

## 2. Site / page inventory

### 2.1 Current live site (as served today)

| Route | Template | Status | Notes |
|---|---|---|---|
| `/` | Home (wens-magazine demo) | 200 | Demo nav (5 links, all `#`), "ADS BANNER", demo footer, same post repeated in every block |
| `/page/2/` | Home paged | 200 | Identical to page 1 (query loops don't paginate) |
| `/{post_id}/` | Single post | 200 | Permalink structure is `/%post_id%/` for all 513 posts |
| `/{page-path}/…/` | Page (hierarchical) | 200 | Unicode (Malayalam) path segments, up to 3 levels deep |
| `/category/{slug}/` + `/page/N/` | Category archive | 200 | 15 non-empty categories; **`കാഴ്ചപ്പാട്‌` → 404** (ZWNJ in slug; even `/?cat=22` redirects into the 404) |
| `/tag/{slug}/` | Tag archive | 200 | Only 3 tags have posts (all theme demo tags) |
| `/author/{slug}/` | Author archive | 200 | `admin`, `editor` |
| `/type/{format}/` | Post-format archive | 200 | video / audio / link |
| `/portfolio/*`, `/portfolio-category/*` | Demo CPT | 200 | 80 + 6 demo URLs (Soledad portfolio), in sitemap |
| `/?s=` | Search | 200 | Works; no result count/pagination metadata |
| `/2022/` | Date archive | **404** | Collides with post-ID permalinks (by design of `/%post_id%/`) |
| `/feed/` | RSS | 200 | **Infected** (115 injected blocks) |
| `/wp-sitemap.xml` | Core sitemap | 200 | 8 sub-sitemaps; lists demo content |
| unknown path | 404 | 404 | Themed 404 page |

Redirects already in place (WordPress core): `/?p=ID` → `/ID/`; `/ID` → `/ID/`; `/index.php/ID/` → `/ID/`; `/?cat=ID` → `/category/slug/`; `/category/x` → `/category/x/`; **old slug URLs `/{malayalam-slug}/` → 301 → `/{id}/`** (proves the site previously used `/%postname%/` permalinks — external backlinks likely use slug URLs).

### 2.2 Original site (Wayback snapshot 2026-04-16 — the design to preserve)

Stack: WordPress 6.4.8, **Soledad** theme, **WPBakery 5.5.2**, plugins: formidable, menu-icons, contact-form-7, featured-video-plus, wp-smart-editor, youtube-embed-plus, ultimate-responsive-image-slider, penci-recipe, penci-review.

**Primary navigation (11 top-level items, 96 total, 3 levels)** — mirrors the knowledge-base page tree: Home · ആദര്‍ശം (വിശ്വാസം → ദൈവം, പ്രവാചകന്മാര്‍, മാലാഖമാര്‍, വേദങ്ങള്‍, വിധിവിശ്വാസം, പരലോകം; അനുഷ്ഠാനം → ശഹാദത്ത് കലിമ, നമസ്‌കാരം, സകാത്ത്, വ്രതം, ഹജ്ജ്) · ഖുര്‍ആന്‍ (ഖുര്‍ആന്‍റെ തീരത്ത് [5], ഖുര്‍ആന്‍റെ ആഴങ്ങളില്‍ [3]) · മുഹമ്മദ് നബി (നബിചരിതം [6], വ്യക്തിത്വം [2], ഹദീസ്) · സാമൂഹികം (പാരസ്പര്യം [5], മാനവികത [4]) · കുടുംബം [5] · സാമ്പത്തികം [10] · രാഷ്ട്രീയവ്യവസ്ഥ [8] · ചരിത്രം [11] · സംസ്‌കാരം [6] · ചോദ്യോത്തരം (category). Top bar: Facebook, Twitter/X, Instagram, YouTube. Full tree saved in `audit/data/original-ia.json`.

**Homepage sections:** സമകാലികം (news) · ചോദ്യോത്തരം (Q&A) · ലേഖനം (articles) · Audios · featured post blocks · ഇസ്‌ലാമിക പാഠങ്ങൾ · E-Books · പ്രകാശ രേഖ · Quick Links · Quick Contact · Follow Us. The `slider` category (253 posts) drove the homepage slider.

Screenshots: `audit/screens/{mobile,tablet,desktop}/` (live) and `audit/screens/original/` (Wayback, JS disabled).

### 2.3 Original design reference (target look & structure for the rebuild)

| Element | Original (Soledad, April 2026) |
|---|---|
| Top bar | Black strip: **About Us · Postal Library** links + Facebook / X / Instagram / YouTube icons |
| Header | Two logos: **Islam Malayalam / ഇസ്‌ലാം മലയാളം** (left) and **Dialogue Centre Kerala** (right); stacked on mobile |
| Navigation | Full-width **blue bar** (HOME highlighted) with 10 dropdown menus (mega-menu of the KB tree); hamburger on mobile |
| Home sections | Blue label-tab headings with a rule: **സമകാലികം** (1 large + 4 list items), **ചോദ്യോത്തരം** (3-column card grid), then ലേഖനം, Audios, E-Books, ഇസ്‌ലാമിക പാഠങ്ങൾ, പ്രകാശ രേഖ; right sidebar on desktop |
| Article | Title, date, body, inline images; back-to-top button |
| KB page | Intro text + **tabs: ഖുര്‍ആന്‍ സൂക്തങ്ങള്‍ (Qur'an verses) / നബി വചനങ്ങള്‍ (Hadith)** → model as `sections[]` |
| Pre-existing defects to fix | Raw `[vc_headings …]` shortcode visible on KB pages even in April 2026; lazy-loaded thumbnails depend on JS (grey boxes when scripts fail — likely the long-standing "images not loading" complaint); broken inline images in some posts |

(Grey thumbnails in the Wayback captures are caused by the audit running with JavaScript disabled, not by the original site.)

---

## 3. Backend / content inventory (public REST API)

| Entity | WordPress | Real content | Demo / junk | Notes |
|---|---|---|---|---|
| Posts | 513 | ~489 | 24 (Soledad demo, 2018-09-10, ids 154, 257–278, 10391–10393) | 502 standard, 6 video, 4 audio, 1 link format |
| Pages | 140 | ~105 (KB tree + home, about, contact, quiz, free-quran, postal) | ~35 (typography, portfolio, grid, gallery, page-full-width, duplicates `-2`/`-3`) | 107 items contain unrendered WPBakery/tagDiv shortcodes |
| Categories | 24 | 11 | 13 (Adventures, Destinations, Featured, Guide & Tips, Photography, Trip Ideas, Finance, Global Trade, Insurances, Retail, Stock Market, Banking, Uncategorized) | `slider` (253) is a placement flag, not a topic |
| Tags | 94 | 0 in use | 3 used (soledad, adventure, blog — demo) | 91 empty tags |
| Media (library) | 613 (header) / 612 returned | 573 JPEG, 26 PNG, 5 PDF, 8 WOFF | — | 1 item not publicly listed (likely attached to non-public content) |
| Files on disk | 9,717 | 616 originals (587 MB) | 9,101 WP size variants (555 MB) | 53 originals not in the media library (orphans) |
| Portfolio CPT | 80 | 0 | 80 | Not exposed in REST (`show_in_rest=false`), visible in sitemap |
| Users | 2 | admin (101 posts), editor (412 posts) | — | No bios, no avatars configured |
| Comments | REST 403 | unknown | — | `comment_status=open` on 512 posts; needs admin/MCP to count |

**Plugins detected** (REST namespaces + frontend assets): Formidable Forms, Contact Form 7, WP Super Cache, Novamira (+ MCP adapter), Menu Icons, Featured Video Plus, WP Smart Editor, YouTube Embed Plus, penci-recipe, penci-review, WP File Download (shortcode), WPBakery (inactive, shortcodes remain), Form Maker (upload folder).

**Content-model facts that matter for migration**
- Post permalinks are `/{id}/`; WordPress slugs are percent-encoded Malayalam (387) or numeric (89).
- Post body HTML is classic-editor HTML (no Gutenberg block comments). Pages are WPBakery shortcode trees (`vc_row/vc_column/vc_column_text`, `vc_tta_tabs/vc_tta_section`, `vc_wp_custommenu`, `accordion_father/son`, `vc_video`, one base64 `vc_raw_html`).
- **Video/audio posts carry the media URL in post meta** (Featured Video Plus / Soledad format meta), not in the body (bodies are ~8 chars). Not available via the public REST API → requires MCP/admin access.
- E-books: 7 posts, 2 link to PDFs in uploads; 5 PDFs in the library.
- Malayalam text uses ZWJ (`&#x200d;`) for old-style chillu letters — **must be preserved in content**; only slugs/URLs need Unicode normalization. U+FFFC object-replacement characters appear next to injection points and should be removed.
- Custom fonts were uploaded to media: Noto Sans Malayalam (Regular/Bold) and "aram" (licence unknown).

---

## 4. Image / media failure report

### 4.1 Verification method
Every URL WordPress generates was range-requested (1 KB) without following redirects, recording status, redirect chain, content-type, Cloudflare cache status and magic bytes: **6,339 unique URLs** (612 originals + all registered size variants + every inline `<img>` `src`/`srcset`/`data-src` in posts and pages). The browser crawl then checked `naturalWidth`/`complete` of every rendered `<img>` on 51 URLs × 2–3 viewports.

### 4.2 Results

| Class | Count | Root cause | Frontend or backend? | Fixed by CDN migration? |
|---|---|---|---|---|
| Site media OK (200, correct type, valid magic bytes) | **6,303** | — | — | Yes (straight copy) |
| Hotlink to `campusalive.in` (post 3142) | 19 | Host no longer resolves; also `http://` → **mixed content** blocked by browsers | Content | No — must recover (Wayback) or remove |
| Hotlink to `beta.islammalayalam.net` (pages 74, 207, 1687, 1694, 1695) | 5 | Old staging host no longer resolves (DNS) | Content | No — recover from uploads/Wayback or remove |
| Hotlink to `majilismedia.com` (post 2699) | 4 | Host no longer resolves | Content | No |
| Hotlink to `soledad.pencidesign.com` (demo pages) | 8 | Redirects to `.net`, blocked by `Cross-Origin-Resource-Policy` (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`) | Content (demo) | N/A — demo pages are dropped |
| Featured image references a **deleted** attachment | 24 posts | Attachments 307–402 return `rest_post_invalid_id` (404) | Data | No — these are the demo posts (dropped) |
| Posts with **no featured image at all** | 55 posts | Never set; 41 of them are in the `slider` category | Data + theme (renders a grey gradient card) | No — needs a designed fallback (generated title card) |
| Cards with no image **and** no title on the homepage | 10 posts | Dates rewritten to 2026-07-02 push these untitled, image-less posts to the top of every homepage query | Data tampering | No — restore dates/titles |

**Conclusion:** the backend media store is healthy. The visible "images not loading" symptom is a **content-data + theme** problem, not a storage/CDN/HTTP fault. A pure URL rewrite to DigitalOcean would **reproduce** the grey cards; the fix is (1) data repair, (2) a designed image fallback, (3) removing/recovering dead hotlinks.

Other media observations: 607/612 library items have **no alt text**; 4 JPEGs are **56 MB each** (`2022/01/Question-Poster*.jpg`) and must be re-encoded; WordPress generated 20+ image sizes per upload (Soledad `penci-*`, `sow-carousel`, `rpg_gallery`, `jr_insta` …) — none of these need migrating.

---

## 5. Network / API failure report

| Item | Result |
|---|---|
| JavaScript page errors (sanitized site) | **0** on all 51 URLs × viewports |
| Console errors | Only resource-load failures listed above + 404s on 404 pages |
| Failed requests | Dead hotlinks (Section 4); deleted **Google Form** embedded on `quiz-2023` (404); Cloudflare Insights beacon (blocked by the audit policy — legitimate) |
| REST API | All `/wp-json/*` responses are **invalid JSON** (malware trailer appended) → any client parsing them (block editor, plugins, Novamira, our migrator) breaks unless it strips the trailer |
| TTFB (direct, unproxied) | 1.2–2.5 s for every PHP page (`cf-cache-status: DYNAMIC`; `PHPSESSID` cookie prevents page caching). Static images ~0.26 s |
| Heavy pages | Post 2407: 3.18 MB HTML, 10.8 s; post 2468: 2.89 MB, 9.7–13.4 s (malware bulk) |
| Redirect chains | Max 1 hop; no loops found |
| Mobile layout | No horizontal overflow at 390 px; skip-link and landmarks present; ~21 tap targets < 24 px per page |
| Mobile menu | Opens correctly, but every item links to `#` (demo menu) |

---

## 6. SEO inventory

| Signal | Current state | Target in rebuild |
|---|---|---|
| `<html lang>` | `en-US` | `ml` (Malayalam) |
| Title | `Post – ISLAM MALAYALAM`; untitled posts → just `ISLAM MALAYALAM` (94 posts) | Per-page titles; derived titles for untitled posts |
| Meta description | None anywhere | From excerpt / first paragraph |
| Canonical | Singular pages only; missing on archives | Everywhere, incl. paginated archives |
| Open Graph / Twitter | None | Full set + generated OG image for posts without images |
| Structured data | None (the old Soledad site had 2 JSON-LD blocks) | `Article`/`NewsArticle`, `BreadcrumbList`, `WebSite`+`SearchAction`, `Organization` |
| Pagination | No `rel=prev/next`; home `/page/2/` duplicates page 1 | Crawlable SSR pagination with self-canonicals |
| Sitemap | Core `wp-sitemap.xml` incl. 80 portfolio + ~35 demo pages + demo tags | Clean `sitemap.xml` of real content only |
| robots.txt | Standard + **malware appended** | Clean, generated |
| Breadcrumbs | None | Visible + JSON-LD (KB pages are 3 levels deep) |
| Internal links | 1,392 internal links in content; 2 spam links | Preserve, rewrite to new canonical forms, drop spam |
| Broken indexable URL | `/category/കാഴ്ചപ്പാട്‌/` 404 | Fixed slug + 301 from both variants |
| Legacy URL forms to keep alive | `/{id}/`, `/{malayalam-slug}/`, `/?p=`, `/?page_id=`, `/?cat=`, `/?s=`, `/category/x/page/N/`, `/wp-content/uploads/…`, `/feed/`, `/wp-sitemap*.xml` | All resolve via 301 or directly |

Google may have indexed malware/spam content; after cutover, submit the new sitemap and request a security review in Search Console.

---

## 7. Data migration requirements

1. **Source of truth:** public REST API for posts/pages/taxonomies/media (already extracted and sanitized), plus **MCP/admin** for: post meta (video/audio URLs, SEO fields), **revisions** (to restore tampered dates/titles), drafts/private items, comments, forms (Formidable / CF7 definitions), menus as currently stored, the one hidden media item.
2. **Sanitize at ingest** (non-negotiable): strip all known injection variants, then an HTML allowlist (no `<script>`, no event handlers, no `javascript:` URLs, iframes only from YouTube/Google Docs). Re-scan every document for IOCs; the migration fails if any remain.
3. **Transform:** WPBakery/tagDiv shortcodes → semantic HTML or structured components (tabs/accordions); `vc_wp_custommenu` → derived from page hierarchy; YouTube embeds normalized; `http://` → `https://`; internal links rewritten to canonical paths; spam links removed; U+FFFC removed; ZWJ preserved.
4. **Repair:** 10 date-tampered posts (restore from revisions; fallback: interpolate from neighbouring IDs, flagged `dateSuspect`); `0020-02-08` → `2020-02-08` (flagged); 94 empty titles → derived from first sentence, flagged `needsReview`; ZWNJ category slug normalized.
5. **Exclude (documented, not deleted from WP):** 24 demo posts, ~35 demo pages, 80 portfolio items, 13 demo categories, 3 demo tags → served as **410 Gone** in the new site.
6. **Idempotent & resumable:** upsert by `wpId`; per-document `sourceHash` so unchanged items are skipped; run log in `migrationRuns`; safe to re-run for delta syncs until cutover.
7. **Verification:** WP vs Mongo counts per type (minus documented exclusions), duplicate check on `wpId`/`slug`/`path`, relationship check (every `categoryId`/`featuredMediaId` resolves), IOC scan = 0, URL-map check (every legacy URL resolves 200/301/410).

---

## 8. MongoDB architecture proposal

Design principle: model around read paths (home feed, category feed, article, KB tree, search), not around WordPress tables.

| Collection | Key fields | Indexes |
|---|---|---|
| `posts` | `wpId`, `slug`, `legacySlugs[]`, `title`, `titleSource`, `excerpt`, `contentHtml` (sanitized), `contentText`, `format` (`standard/video/audio/link`), `featuredMediaId`, `video{provider,id,url}`, `audio{url}`, `attachments[]`, `categoryIds[]`, `primaryCategoryId`, `authorId`, `featured` (was `slider`), `status`, `flags{needsReview,dateSuspect}`, `publishedAt`, `updatedAt`, `seo{title,description,ogMediaId,noindex}`, `readingMinutes`, `migration{sourceHash,runId,at}` | `{wpId:1}` unique · `{slug:1}` unique · `{status:1,publishedAt:-1,_id:-1}` · `{categoryIds:1,status:1,publishedAt:-1,_id:-1}` · `{featured:1,publishedAt:-1}` · `{authorId:1,publishedAt:-1}` · search index on `title`+`contentText` |
| `pages` | `wpId`, `path` (full Unicode path, NFC), `slug`, `parentId`, `ancestors[{id,slug,title}]`, `order`, `title`, `contentHtml`, `sections[]` (from tabs), `kind` (`kb/static/landing`), `seo{…}`, `migration{…}` | `{path:1}` unique · `{parentId:1,order:1}` · `{wpId:1}` unique |
| `categories` | `wpId`, `slug`, `legacySlugs[]`, `name`, `description`, `parentId`, `postCount`, `order`, `nav` | `{slug:1}` unique · `{wpId:1}` unique |
| `authors` | `wpId`, `slug`, `displayName`, `bio`, `avatarMediaId` | `{slug:1}` unique |
| `media` | `wpId?`, `key` (Spaces object key), `cdnUrl`, `legacyUrls[]`, `mime`, `bytes`, `width`, `height`, `blurDataURL`, `alt`, `caption`, `sha256`, `variants[{w,format,key}]`, `status` (`ok/missing/dead-external`), `source` (`library/orphan/inline`) | `{sha256:1}` unique · `{legacyUrls:1}` · `{wpId:1}` unique sparse |
| `menus` | `key` (`primary/footer/quick`), `items` (tree: title, href, children) | `{key:1}` unique |
| `redirects` | `from` (normalized path+query), `to`, `code` (301/308/410), `source`, `hits` | `{from:1}` unique |
| `settings` | site name, tagline, social, contact | singleton |
| `migrationRuns` | counts in/out, diffs, errors, duration | `{startedAt:-1}` |
| `contactMessages` (if forms kept) | name, email, message, ipHash, createdAt, status | `{createdAt:-1}`, TTL optional |

- **Pagination:** page-number SSR (`skip/limit`) on the compound indexes above is appropriate here — the largest listing is ~26 pages. Counts are cached per tag and invalidated on publish.
- **Slugs:** stored NFC-normalized; zero-width characters stripped from slugs only; legacy variants kept in `legacySlugs`/`redirects`.
- **Search:** MongoDB `$text` has no Malayalam analyzer (use `default_language: "none"` = whitespace tokens). If hosted on **MongoDB Atlas**, use Atlas Search with an ICU tokenizer for proper Malayalam search. **Decision needed** (see Section 12).

---

## 9. DigitalOcean media migration proposal

- **Bucket:** Spaces in **`blr1` (Bangalore)** — nearest region to Kerala — with the built-in CDN and a custom subdomain, e.g. `media.islammalayalam.net` (TLS via DO/Let's Encrypt).
- **What to migrate:** 616 originals (+ review the 53 orphans); **skip the 9,101 WordPress size variants** (555 MB) — the new pipeline regenerates what the new design needs.
- **Pipeline per file:** download → verify magic bytes/MIME → SHA-256 (dedupe) → strip EXIF GPS → cap long edge (e.g. 2560 px; fixes the 56 MB posters) → generate AVIF + WebP at fixed widths (e.g. 320/640/960/1280/1920) + a tiny `blurDataURL` → upload with `Cache-Control: public, max-age=31536000, immutable` → HEAD-verify from CDN → write `media` doc.
- **Keys:** `media/{yyyy}/{mm}/{ascii-slug}-{hash8}.{ext}` and `media/…/{name}-{hash8}-w{width}.{avif|webp}` — ASCII-safe, content-addressed; legacy Malayalam filenames kept in `legacyUrls`.
- **Legacy URLs:** `/wp-content/uploads/…` → 301 to the CDN URL (Google Images and external sites link to these).
- **Dead hotlinks:** attempt recovery from the Wayback Machine; otherwise remove the `<img>` and flag the post.
- **Keep WordPress media untouched** until the new site has been verified in production.
- Access keys: bucket-scoped key, server-side only; objects public-read, bucket listing private.

---

## 10. Next.js architecture proposal

- **Stack:** Next.js (latest stable, App Router, TypeScript strict), React Server Components by default, Tailwind CSS, MongoDB (native driver + zod-validated repositories in a `server-only` data layer), sharp for the media pipeline, Playwright for E2E.
- **Content editing (backend):** the site is still active, so editors need an admin. Recommended: **Payload CMS 3** installed inside the same Next.js app (official MongoDB adapter, S3-compatible storage adapter for DO Spaces, auth, roles, drafts, versions) instead of hand-building an admin. **Decision needed.**
- **Routes:** `/` · `/[id]` (numeric → post) · `/category/[slug]` (`?page=N`) · `/author/[slug]` · `/search` (`?q=`) · `/[...path]` (KB pages; also resolves legacy slug URLs → 301) · `/feed` (RSS route handler) · `sitemap.ts` · `robots.ts` · `middleware.ts` for legacy query-string redirects (`?p=`, `?page_id=`, `?cat=`, `?s=`, `/page/N/`) and 410s.
- **Rendering & caching:** posts/pages statically generated + tag-based on-demand revalidation on publish; archives SSR with cached queries; search fully dynamic; `generateMetadata` everywhere; `next/og` title-card images for posts without a featured image.
- **Loading states:** route-level `loading.tsx` with layout-matched skeletons (home, article, KB page, category, search, author) + `Suspense` for secondary blocks (related posts, sidebar tree); a shared shimmer primitive, not one generic spinner.
- **Mobile-first UI:** Malayalam-first typography (self-hosted Noto Sans Malayalam / Anek Malayalam via `next/font`, 17–18 px body, 1.8 line-height), 44 px touch targets, bottom-sheet navigation for the 81-item KB menu, sticky compact header, reading progress on articles, accessible tabs/accordions for KB sections.
- **Security:** nonce-based CSP, HSTS, frame-ancestors none, rate-limited search/contact endpoints, zod input validation, no `dangerouslySetInnerHTML` except for content that was allowlist-sanitized at ingest, secrets only in server env.
- **Code organization:** ≤ ~500 lines per file; `app/(site)/…` routes → `components/`, `features/{posts,pages,search}/{queries,components}`, `lib/{db,seo,media}`, `scripts/migrate/*`.

---

## 11. Risks & unknowns

| # | Risk / unknown | Impact | Mitigation |
|---|---|---|---|
| 1 | Attacker still has access (re-infection on 09-28) | Content keeps changing; delta syncs may import new malware | Sanitize + IOC gate on every run; containment first |
| 2 | **Novamira MCP is not connected to this session** (the `claude mcp add …` command must be run in your terminal, then OAuth, then restart) | Post meta, revisions, drafts, comments, forms unreachable | Connect after credential rotation; treat all MCP output as untrusted data |
| 3 | Video/audio URLs live only in post meta | 10 media posts would migrate empty | Pull via MCP; fallback: Wayback copies of those posts |
| 4 | Original dates/titles of tampered posts | Wrong chronology, SEO dates | Revisions via MCP; fallback interpolation + review flag |
| 5 | 94 untitled posts | Poor SEO/UX | Derived titles + editorial review list |
| 6 | Malayalam search quality | Weak search on `$text` | Atlas Search (ICU) or external search |
| 7 | Hosting choices (Mongo, Next.js, CDN/DNS with Cloudflare) | Architecture details | Decision list in Section 12 |
| 8 | Unknown backlinks to old slug URLs | Lost SEO equity | Keep slug → ID redirects; monitor 404s after launch |
| 9 | "aram" font licence | Legal | Replace with open-licence Malayalam fonts |
| 10 | Google Safe Browsing / search penalties from the infection | Traffic loss | Search Console security review after cleanup |

---

## 12. Recommended migration sequence

| Phase | Work | Exit criteria |
|---|---|---|
| **0 — Containment (now)** | Cloudflare Worker sanitizer; backup; remove persistence; rotate credentials; update/remove plugins | No IOC in live responses; Defender clean on homepage |
| **1b — Finish discovery** | Connect Novamira MCP; pull meta, revisions, drafts, comments, forms, hidden media | Inventory gaps in Section 3 closed |
| **2 — Data architecture** | Finalize schemas/indexes above; URL map + redirect table; media key scheme | Reviewed spec |
| **3 — Migration pipeline** | Extract → sanitize → transform → load (idempotent); media → Spaces; verification report | Counts match; 0 IOCs; 0 broken media; every legacy URL resolves |
| **4 — Next.js build** | Shell, mobile-first design system, data layer, routes, SSR pagination, skeletons, SEO, error states, admin | Feature-complete on staging with real data |
| **5 — Verification** | Typecheck, lint, Playwright (3 viewports), old-vs-new comparison, Lighthouse/CWV, security review | All critical/high issues fixed |
| **6 — Cutover** | DNS switch, redirects live, sitemap submitted, WP kept read-only as fallback | Production-readiness report signed off |

### Decisions needed from you before Phase 2
1. **Admin/CMS:** Payload CMS inside Next.js (recommended) · custom admin · no admin (read-only archive).
2. **MongoDB hosting:** MongoDB Atlas (best Malayalam search) · DigitalOcean Managed MongoDB.
3. **App hosting:** DigitalOcean App Platform · Droplet + PM2/Docker · other.
4. ~~Design baseline~~ — **decided (2026-09-29):** rebuild the site *exactly* as the real IslamMalayalam.net — the original Soledad-era information architecture, menu, homepage sections, content and URLs — with a modern, mobile-first implementation. The current WENS demo layout is not a reference.
5. **Demo content:** confirm it is excluded and served as 410.
6. **Incident response:** who cleans the WordPress server; should we prepare the Cloudflare Worker mitigation now.

---

## 13. Mandatory security requirements for the new platform

**Status: required, not optional (owner decision 2026-09-29).** Every item below is a release blocker. Baseline: OWASP ASVS Level 2 + OWASP Top 10.

| Area | Requirement |
|---|---|
| **Secrets** | Server-side env only (never `NEXT_PUBLIC_*`); separate keys per environment; DB, Spaces, CMS, SMTP, WordPress and MCP credentials never reach the browser; secret scanning (gitleaks) in pre-commit + CI; documented rotation. |
| **Authentication (admin)** | Argon2id/bcrypt hashing; **mandatory TOTP MFA** for every admin/editor; no `admin` usernames; login throttling + lockout; Turnstile on login; `__Host-` session cookies with `HttpOnly`, `Secure`, `SameSite=Lax`; short sessions with rotation; logout invalidates server-side. |
| **Authorization** | Deny-by-default RBAC (admin / editor / author); checked server-side in every route handler, server action and CMS hook; drafts never served publicly; admin audit log (who changed what, when). |
| **Input validation** | zod schemas on every input (route params, `?page`, `?q`, forms, API bodies); length limits; unknown keys rejected; invalid page numbers → 404/redirect, never errors. |
| **NoSQL injection** | No request objects passed into queries; values cast to primitives; `$`-prefixed keys rejected; `sanitizeFilter`; strict collection validators. |
| **XSS** | Content sanitized at ingest *and* on every admin save (server-side allowlist: no `<script>`, event handlers, `javascript:` URLs; iframes only from allowlisted hosts); React escaping everywhere else; nonce-based CSP with `strict-dynamic`, no `unsafe-eval`, no `unsafe-inline` scripts; Trusted Types where supported. |
| **CSRF** | `SameSite` cookies + Origin/Host verification on all mutations (built into Next server actions) + tokens on classic form posts. |
| **Rate limiting / abuse** | Per-IP and per-account limits on login, search, contact and any API; Cloudflare WAF rate-limit rules as the outer layer; Turnstile on public forms; request body size limits. |
| **File uploads** | Presigned direct-to-Spaces uploads with enforced content-type and size; magic-byte verification; extension allowlist; every image re-encoded with sharp (strips EXIF and embedded payloads); SVG disallowed or sanitized; random object keys; optional ClamAV scan. |
| **Security headers** | CSP (nonce), HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo off), `frame-ancestors 'none'`, COOP/CORP. Verified by automated test. |
| **CORS** | Same-origin only; no wildcard; no public write APIs. |
| **Error handling** | Generic user-facing error pages; no stack traces, query details or versions in responses; structured server logs with request IDs; no secrets/PII in logs. |
| **Transport** | HTTPS everywhere, TLS 1.2+, HSTS preload, TLS to MongoDB. |
| **Database** | Private networking / trusted-sources allowlist; least-privilege users (read-only app user for the public site, separate CMS writer, separate migration user); encrypted automated backups + point-in-time recovery + a tested restore. |
| **Object storage / CDN** | Bucket-scoped keys; no public bucket listing; public-read only for published media; long-lived immutable caching only on content-hashed keys. |
| **Edge / WAF** | Cloudflare in front: managed WAF rules, bot protection, DDoS, rate limits; origin locked to Cloudflare (firewall allowlist or authenticated origin pulls). |
| **Supply chain** | Lockfile committed; minimal dependencies; `npm audit`/OSV scan in CI; Renovate/Dependabot; no unreviewed install scripts; SBOM on release. |
| **Content-integrity monitoring** | Reuse the audit sanitizer as a scheduled job that scans every document in MongoDB and a Playwright synthetic check of key rendered pages for `<script>`/IOC patterns → alert. This detects the exact class of attack that hit the WordPress site. |
| **Monitoring & response** | Uptime checks, error tracking, security alerting, admin audit trail, written incident runbook, contact point for security reports (`/.well-known/security.txt`). |
| **Privacy** | Minimal personal data; retention limit (TTL) on contact messages; cookie-less analytics; privacy policy page. |
| **Security testing** | CI gates: header/CSP tests, authz tests per role, rate-limit tests, dependency + secret scans, OWASP ZAP baseline scan against staging; manual pre-launch review with the `security-reviewer` checklist. |
| **Legacy decommission** | After cutover, WordPress is not left publicly reachable: firewalled or shut down, database and uploads archived offline, DNS records for old hosts removed. |

---

## Appendix — audit artifacts

| Path | Contents |
|---|---|
| `audit/lib/sanitize.mjs` | Malware stripping + IOC detection (fail-closed) |
| `audit/lib/guard.mjs` | 5-layer browser guard used for the crawl |
| `audit/scripts/dump-wp.mjs` | Sanitized REST extraction + per-item infection stats |
| `audit/scripts/check-media.mjs` | 6,339-URL media verification |
| `audit/scripts/list-uploads.mjs` | Uploads directory enumeration (listing pages only) |
| `audit/scripts/discover.mjs` | Theme/plugins/SEO/meta discovery |
| `audit/scripts/crawl.mjs` · `summarize-crawl.mjs` | Guarded Playwright audit (mobile 390×844, tablet 820×1180, desktop 1440×900) |
| `audit/scripts/archive-shots.mjs` | Original IA + screenshots from Wayback (JS disabled) |
| `audit/data/wp/*.json` | Sanitized posts, pages, categories, tags, media, users + infection stats |
| `audit/data/media-check.json`, `uploads-listing.json`, `crawl.json`, `crawl-summary.json`, `discovery.json`, `original-ia.json` | Raw evidence |
| `audit/screens/` | Screenshots (live and original) |
