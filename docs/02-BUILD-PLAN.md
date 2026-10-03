# IslamMalayalam.net — Build Plan (Phase 2)

**Date:** 2026-09-29 · **Input:** [audit/01-AUDIT-REPORT.md](audit/01-AUDIT-REPORT.md) · **Status:** awaiting go-ahead before any application code is written

---

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Target | **Exact** rebuild of the real IslamMalayalam.net (original Soledad-era IA, menus, homepage sections, content, URLs) — modern, mobile-first. The current WENS demo layout is not a reference. |
| Security | Every item in audit §13 is mandatory and release-blocking. |
| Admin | WordPress-style admin with full CRUD on all content **and** dynamic control of the frontend (menus, homepage sections, header/footer, settings) → **Payload CMS 3** embedded in the Next.js app. |
| Media | **DigitalOcean Spaces + CDN** (region `blr1`) |
| Data | **MongoDB** for everything else — DigitalOcean Managed MongoDB |
| App hosting | **DigitalOcean App Platform** |
| Migration safety | Zero-malware gates on every record and file (§6) — nothing from the infected WordPress reaches the new system unverified. |

## 2. Stack (versions verified on npm, 2026-09-29)

Next.js **16.3.6** (App Router, RSC) · Payload **3.90.2** (`@payloadcms/next`, `db-mongodb`, `storage-s3`, `richtext-lexical`) · MongoDB driver 7.7 · TypeScript strict · Tailwind CSS · zod 4 · sharp 0.35 · sanitize-html 2.17 · `payload-totp` 3.0.4 (admin MFA) · Playwright 1.63 · Node 22.

Why Payload: proven admin UI, auth with lockout, roles, drafts/versions, uploads to S3-compatible storage (DO Spaces), MongoDB adapter, runs inside the same Next.js app (one deployment). Content is stored as **Lexical JSON** and rendered by React — no raw HTML injection on the public site, which removes the XSS class of attack that hit WordPress.

## 3. Architecture

```
Browser ──► Cloudflare (WAF, DDoS, cache) ──► DO App Platform: Next.js 16 + Payload
                                                   │  public site (RSC, ISR, SSR pagination)
                                                   │  /admin  (Payload, MFA, RBAC)
                                                   │  /api    (Payload REST, rate-limited)
                                                   ├──► DO Managed MongoDB (private network, TLS)
                                                   └──► DO Spaces (media originals + AVIF/WebP) ──► Spaces CDN (media.islammalayalam.net)
Migration (one-off + delta re-runs, local/CI): WordPress REST/MCP ─► sanitize/transform/verify ─► Payload Local API
```

## 4. Content model (Payload)

### Collections
| Collection | Key fields | Notes |
|---|---|---|
| `posts` | title, slug, `wpId` (unique), legacySlugs, excerpt, content (Lexical), format (standard/video/audio/link), video{provider,id}, audio{url}, attachments (PDFs), featuredImage→media, categories→categories, primaryCategory, author→authors, featured (was `slider`), publishedAt, seo{title,description,image,noindex}, flags{needsReview,dateSuspect,titleDerived} | Drafts + versions; public URL `/{wpId}/` (new posts get the next free numeric id) |
| `pages` | title, slug, parent→pages, **path** (computed, unique), order, intro (Lexical), **sections[]** {title, content} (the Qur'an / Hadith tabs), kind (kb/static), seo, `wpId` | Hierarchical KB tree; URL = full Malayalam path |
| `categories` | name, slug (NFC, zero-width stripped), legacySlugs, description, parent, order, `wpId` | ZWNJ bug fixed with 301s |
| `authors` | name, slug, bio, avatar | Public bylines (separate from admin users) |
| `media` | file (Spaces), alt (required for new uploads), caption, width/height, blurDataURL, sha256, legacyUrls[], `wpId` | Upload hooks: magic-byte check, sharp re-encode, AVIF/WebP sizes |
| `redirects` | from, to, code (301/308/410), source, hits | Admin-editable; served by middleware |
| `contact-messages` | name, email, message, ipHash, status | Turnstile + rate limit; TTL retention |
| `users` (admin) | email, name, role (admin/editor/author), TOTP | Lockout after 5 failures; MFA mandatory |
| `audit-log` | user, action, collection, docId, at | Written by hooks on every change |

### Globals (dynamic frontend control)
| Global | Controls |
|---|---|
| `site-settings` | Site name, tagline, logos (Islam Malayalam + Dialogue Centre Kerala), social links, contact info, default SEO/OG |
| `top-bar` | About Us / Postal Library links, social icons |
| `main-menu` | The 11-section / 96-item mega-menu (tree editor; items link to pages, categories, posts or URLs) — seeded from the recovered original |
| `homepage` | **Layout builder** — ordered blocks: `CategoryFeature` (1 large + 4 list, e.g. സമകാലികം), `CategoryGrid` (3-col, e.g. ചോദ്യോത്തരം), `CategoryList`, `FeaturedSlider` (posts with `featured`), `Ebooks`, `Audios`, `Videos`, `QuickLinks`, `RichText`, `Banner` — each block picks category, count, title, colour |
| `footer` | Columns, quick links, quick contact, copyright |

## 5. URL & SEO strategy (preserve everything)

| Legacy | New |
|---|---|
| `/{id}/` (all 513 posts) | Same path, served directly |
| `/{malayalam-slug}/` (pre-2019 permalinks) | 301 → `/{id}/` |
| KB `/{a}/{b}/{c}/` | Same path (Unicode, NFC) |
| `/category/{slug}/`, `/category/{slug}/page/N/` | `/category/{slug}/` + `?page=N` (301 from `/page/N/`) |
| `/?p=`, `/?page_id=`, `/?cat=`, `/?s=` | 301 → canonical page / `/search?q=` |
| `/tag/*`, `/portfolio/*`, `/portfolio-category/*`, demo pages/categories | **410 Gone** |
| `/type/video/` etc. | 301 → matching category |
| `/wp-content/uploads/…` | 301 → CDN URL (via `media.legacyUrls`) |
| `/feed/`, `/wp-sitemap*.xml` | `/feed/` (clean RSS), `/sitemap.xml` (301 from old) |

SEO per page: `generateMetadata` (title, description, canonical incl. paginated), Open Graph + Twitter, JSON-LD (`Article`, `BreadcrumbList`, `WebSite`+`SearchAction`, `Organization`), `lang="ml"`, generated OG title-card images for posts without a featured image, `robots.ts`, `sitemap.ts`.

## 6. Migration pipeline with zero-malware gates

Stages (each idempotent; upsert by `wpId`; skip when `sourceHash` unchanged; resumable; run log in `migration-runs`):

1. **Extract** — public REST (done in audit) + Novamira MCP for post meta, revisions, drafts, comments, forms. Responses sanitized in memory before anything is stored.
2. **Gate A — text:** known-variant removal (`audit/lib/sanitize.mjs`) → strict HTML allowlist (sanitize-html: no script/style/on*/`javascript:`/forms; iframes only YouTube/Google Docs) → IOC scan. **Any residual IOC = record rejected**, listed in the report, never loaded.
3. **Transform** — HTML → Lexical (`convertHTMLToLexical`); WPBakery tabs → `sections[]`; shortcodes stripped; YouTube → embed block; internal links → new canonical paths; spam links removed; `http://` → `https://`; ZWJ preserved, U+FFFC removed; titles derived for 94 untitled posts (flagged); dates restored from revisions (fallback interpolation, flagged).
4. **Gate B — files:** download only from `islammalayalam.net/wp-content/uploads/`; extension + MIME **allowlist** (jpg, png, gif, webp, pdf); magic-byte check must match; **every image re-encoded by sharp** into a brand-new file (destroys embedded payloads and EXIF); PDFs scanned for `/JavaScript`, `/OpenAction`, `/Launch`, `/EmbeddedFile`, `/AA` → quarantined if present; everything else (fonts, css, unknown) not migrated; optional ClamAV scan; SHA-256 recorded.
5. **Load** — Payload Local API (runs hooks/validation), media to Spaces with immutable caching.
6. **Gate C — verify:** counts WP vs Mongo (minus documented exclusions); no duplicate `wpId`/slug/path; every relation resolves; every CDN URL returns 200 with the right MIME; full-database IOC scan = 0; Playwright render check of every template = 0 console errors, 0 broken images; every legacy URL resolves 200/301/410.
7. **Report** — `docs/migration/verification-report.md` with the count table required by the brief.

Excluded (documented, reversible): 24 demo posts, ~35 demo pages, 80 portfolio items, 13 demo categories, 3 demo tags.

## 7. Frontend

- **Routes:** `(site)/page.tsx` (home from `homepage` global) · `(site)/[id]/` numeric → post · `(site)/category/[slug]/` · `(site)/author/[slug]/` · `(site)/search/` · `(site)/[...path]/` (KB page or legacy slug → 301) · `feed` route · `not-found`, `error` per segment · `(payload)/admin`.
- **Rendering:** posts/pages static + tag revalidation on publish (Payload `afterChange` hook → `revalidateTag`); archives SSR with cached queries; search dynamic; SSR page-number pagination with self-canonical, prev/next, 404 for out-of-range pages.
- **Skeletons:** per-route `loading.tsx` matching the real layout (home sections, article, KB page with tabs, category grid, search list) + `Suspense` for secondary blocks; one shared shimmer primitive.
- **Design system:** tokens taken from the original (black top bar, brand blue nav, blue label-tab section headings, white cards); Malayalam typography via `next/font` (Noto Sans Malayalam / Anek Malayalam, 17–18 px body, 1.8 line-height); 44 px touch targets; mobile bottom-sheet mega-menu with search; sticky compact header; reading progress on articles; accessible tabs/accordions; dark-mode ready.
- **Code rules:** ≤ ~500 lines per file; `src/app`, `src/components/{ui,blocks,layout}`, `src/features/{posts,pages,search,menu}/{queries,components}`, `src/payload/{collections,globals,hooks,access}`, `src/lib/{db,seo,media,security}`, `scripts/migrate/*`.

## 8. Security implementation (maps to audit §13)

Payload auth (`maxLoginAttempts: 5`, `lockTime`), `payload-totp` enforced for all roles, `__Host-` cookies · access-control functions per collection/field (deny by default) + `audit-log` hooks · zod on every route param and form · Mongo queries only through Payload/typed repositories (no raw request objects) · Lexical rendering (no `dangerouslySetInnerHTML`) · nonce CSP + HSTS + full header set in `middleware.ts`/`next.config` · rate limiting (Mongo-backed token bucket) on login, search, contact, API + Cloudflare rules · Turnstile on contact/login · upload hooks (§6 Gate B) also apply to admin uploads · Spaces bucket-scoped keys, private listing · DB private network + least-privilege users · gitleaks + `npm audit` + OSV + ZAP baseline in CI · scheduled content-integrity scan (reuses the audit IOC scanner) · `/.well-known/security.txt`.

## 9. Testing

Unit (zod schemas, slug/URL normalizers, sanitizer, transforms) · integration (migration stages against fixtures, Payload access rules per role) · E2E Playwright on mobile/tablet/desktop (home, navigation + mega-menu, category pagination, article, KB tabs, search, 404/410/redirects, admin login + MFA, CRUD smoke) · visual comparison with the original Wayback captures · Lighthouse CI budgets (LCP < 2.5 s, CLS < 0.1, INP < 200 ms) · security tests in CI. Target ≥ 80 % coverage on non-UI code.

## 10. Task list

| # | Task | Output / exit check |
|---|---|---|
| 1 | Scaffold Next 16 + Payload 3 + Mongo adapter + S3 adapter + Tailwind + lint/typecheck/test tooling; local Mongo | App boots, `/admin` login with TOTP |
| 2 | Collections, globals, access control, audit log, upload security hooks | Admin CRUD for every type; role tests pass |
| 3 | Migration: extract (+MCP) → gates → transform → load; media → Spaces | Verification report: counts match, 0 IOCs, 0 broken media |
| 4 | Seed globals from original IA (menu, homepage blocks, top bar, footer, logos) | Admin shows original structure |
| 5 | Design system + layout (top bar, header, mega-menu, footer) mobile-first | Matches original structure on 3 viewports |
| 6 | Home (block renderer), article, KB page (tabs), category (SSR pagination), author, search | All templates render real data |
| 7 | Skeletons, error/404/410 pages, empty states | Per-route loading states |
| 8 | SEO: metadata, JSON-LD, sitemap, robots, RSS, OG images, redirects middleware | Every legacy URL resolves |
| 9 | Security hardening + CI security gates | §13 checklist green |
| 10 | Playwright E2E, visual comparison, performance pass | All green |
| 11 | DO provisioning (App Platform, Managed Mongo, Spaces+CDN), staging deploy | Staging live |
| 12 | Cutover: DNS, Search Console, WordPress decommission | Production-readiness report |

## 11. Needed from you

1. **Go-ahead on this plan** (tasks 1–2 can start immediately with a local database).
2. **DigitalOcean access** when we reach task 3/11: a Spaces bucket + access key, a Managed MongoDB cluster connection string, an App Platform app. Put secrets in a local `.env` file yourself — never paste them into chat.
3. **Domain/DNS control:** whoever controls `islammalayalam.net` DNS (currently Cloudflare) must take part at cutover — **without DNS access the new site cannot go live on this domain.** Please identify that person now.
4. **Novamira MCP connection** (run the `claude mcp add …` command in your terminal, finish OAuth, restart) for post meta, revisions, drafts, comments, forms.
5. Original **logo files** if you have them (otherwise they will be taken from the old uploads).
