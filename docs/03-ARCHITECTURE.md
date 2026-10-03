# IslamMalayalam.net — System Architecture

**Status:** Phase "Architecture" · 2026-09-29 · Inputs: [audit report](audit/01-AUDIT-REPORT.md), [build plan](02-BUILD-PLAN.md)

## 1. Pipeline and trust boundaries

```
 ZONE 0 — UNTRUSTED (compromised)          ZONE 1 — QUARANTINE / GATES              ZONE 2 — TRUSTED STORE
 ┌──────────────────────────────┐   read   ┌──────────────────────────────────┐    ┌───────────────────────────┐
 │ WordPress (source of truth   │ ───────► │ migration/extract  (memory only) │    │ MongoDB (Payload-managed) │
 │ until validation; READ-ONLY) │  REST /  │ migration/gates                  │    │  posts, pages, categories │
 │ REST · Novamira MCP · uploads│  MCP     │   A text  : strip → allowlist →  │    │  media meta, menus, …     │
 └──────────────────────────────┘          │             IOC scan (fail-closed)│    └────────────▲──────────────┘
                                           │   B files : type allowlist →     │                 │ Local API only
                                           │             magic bytes →        │    ┌────────────┴──────────────┐
                                           │             re-encode / PDF scan │    │ ZONE 3 — Payload CMS       │
                                           │   quarantine = metadata only     │───►│  collection hooks re-check │
                                           │ migration/transform (HTML→Lexical)│   │  EVERY write (migration and│
                                           └──────────────────────────────────┘    │  editors): content guard,  │
                                                                                   │  media guard, audit log,   │
                                                                                   │  RBAC + TOTP               │
                                                                                   └────────────┬──────────────┘
                                                                                                │ published only
 ZONE 5 — DELIVERY                                                                 ┌────────────▼──────────────┐
 ┌──────────────────────────────┐        media files (prod)                        │ ZONE 4 — Next.js frontend  │
 │ DigitalOcean Spaces + CDN    │ ◄──────────────────────────────────────────────── │  server-only data layer   │
 │ (dev: local ./media folder)  │ ──── images/PDFs to browser                       │  Lexical → React (no raw  │
 └──────────────────────────────┘                                                   │  HTML), nonce CSP         │
                                                                                   └───────────────────────────┘
```

Rules enforced by the code layout:

1. **Nothing in `src/` ever talks to WordPress.** Only `migration/` reads WordPress, and only through the gates.
2. **Raw WordPress payloads are never persisted.** Extraction keeps them in memory; only gate-approved records reach the staging area or the CMS. Quarantine entries keep metadata (id, reason, IOC ids) — never the payload.
3. **The CMS re-validates every write**, whoever makes it (migration script or editor): IOC scan of all rich text, a Lexical node allowlist, URL-scheme allowlist, media type/magic-byte check with re-encoding. A bug in the migration therefore cannot smuggle malware into MongoDB.
4. **The frontend reads only through the Payload Local API** with public access rules (`published` only) and renders rich text as React elements. There is no `dangerouslySetInnerHTML` on content paths.
5. **WordPress is never written to.** Migration code has no write client for WordPress.

## 2. Audit findings → architectural controls

| Audit finding | Control | Where |
|---|---|---|
| Malware stored in 489 posts (5 variants) | Gate A (strip → HTML allowlist → IOC fail-closed) + CMS content guard on every write | `migration/gates/`, `src/payload/hooks/contentGuard.ts` |
| Output-buffer / data-URI script injection in every page | Frontend never renders stored HTML; nonce-based CSP; no inline third-party scripts | `src/proxy.ts`, `src/components/richtext/` |
| REST JSON corrupted by trailer | Extractor strips trailer before parsing; never trusts content-type | `migration/extract/` |
| Media healthy but hotlinks dead / images missing | Media collection with `legacyUrls`, designed fallback card, dead-link report | `src/payload/collections/Media.ts`, `src/components/cards/` |
| Unknown / risky upload types (fonts, CSS, form-maker dir) | File type allowlist: jpeg, png, gif, webp, pdf only; SVG rejected; images re-encoded | `src/lib/media/`, `src/payload/hooks/mediaGuard.ts` |
| Date-tampered / untitled posts | `flags.dateSuspect`, `flags.titleDerived`, `flags.needsReview` surfaced in admin list views | `src/payload/collections/Posts.ts` |
| ZWNJ category slug → 404 | Slug normaliser: NFC, zero-width chars stripped from slugs only, content untouched | `src/lib/text/slug.ts` |
| Raw WPBakery shortcodes on 107 pages | KB `sections[]` model (Qur'an / Hadith tabs) + transform stage | `src/payload/collections/Pages.ts`, `migration/transform/` |
| Demo content indexed | Not migrated; 410 via `redirects` collection | `src/payload/collections/Redirects.ts` |
| Weak auth (`admin` user, no MFA, enumeration) | Payload auth + lockout + mandatory TOTP; users not publicly readable; roles | `src/payload/collections/Users.ts` |
| No security headers / session cookie on every page | Full header set + nonce CSP in proxy; public pages set no cookies | `src/proxy.ts`, `next.config.ts` |
| Theme swap destroyed IA | IA is data: `header` global (menu tree), `homepage` global (layout blocks) — editable, versioned, audited | `src/payload/globals/` |
| Re-infection went unnoticed for days | Audit log on every write + scheduled integrity scan (later phase) | `src/payload/hooks/auditLog.ts` |

## 3. Repository layout

```
/                     Next.js 16 + Payload 3 app (one deployable)
  src/app/(frontend)  public site (mobile-first)            src/app/(payload)  admin + REST (generated)
  src/payload/        collections · globals · blocks · access · hooks · fields · editor
  src/features/       server-only queries per domain (site, posts, pages, categories)
  src/components/     ui · layout · blocks · cards · richtext · skeletons
  src/lib/            env · security (IOC, URL) · text (slug, Malayalam) · media (magic bytes, PDF scan)
  src/proxy.ts        CSP nonce, security headers, x-pathname, legacy /?s= search redirect
  src/payload/admin/  admin branding (logo/icon) + editorial dashboard (server components)
migration/            WordPress → gates → Payload (separate, idempotent; not bundled into the app)
audit/                Phase-1 read-only audit tooling (separate package)
tests/unit|int|e2e    Vitest unit + integration (against local Mongo), Playwright E2E
docs/                 audit, plan, architecture, phase reports
```

## 4. Environments

| | Local dev (now) | Staging / production (later, on your go-ahead) |
|---|---|---|
| Database | `mongodb://127.0.0.1/islammalayalam_dev` (local service, own DB) | DO Managed MongoDB (private network, TLS, least-privilege users) |
| Media | Local `./media` folder (git-ignored) | DO Spaces `blr1` + CDN (`@payloadcms/storage-s3`, enabled only when its env vars exist) |
| Secrets | `.env` (git-ignored, generated locally) | App Platform encrypted env vars; never in the repo or chat |
| TOTP | Enabled (can be disabled only in `NODE_ENV=test`) | Enabled + forced setup |

## 5. Production-impact notes

- **Nonce CSP ⇒ HTML is rendered per request.** Pages cannot be served as static HTML from a CDN, because each response carries a fresh nonce. Performance comes from cached data reads (`unstable_cache` + tags, revalidated on publish) and CDN-cached media. Expected server render: tens of milliseconds. Alternative (experimental hash-based SRI CSP allowing static pages) will be evaluated in the performance phase; nonce CSP is the safe default.
- **Payload hooks add a few ms per write** (IOC scan, Lexical walk, image re-encode). Negligible for editors; the migration of ~650 documents and ~620 images takes minutes.
- **Public pages set no cookies**, so Cloudflare can still cache static assets and media aggressively.

## 6. Admin experience and live preview

- **Branding:** logo on the login/TOTP screens, star-mark icon in the navigation, brand colours on primary buttons and focus rings (`src/payload/admin/graphics.tsx`, `src/app/(payload)/custom.scss`). Works in the admin's light and dark themes.
- **Dashboard** (`admin.components.beforeDashboard` → `src/payload/admin/Dashboard.tsx`): quick actions filtered by the user's permissions; totals (published, drafts, needs review, pages, media); lists of recent drafts and posts flagged `needsReview` (migration flags). All queries run **as the signed-in user** (`overrideAccess: false`), so a session that is not TOTP-verified sees nothing.
- **Roles and drafts:** editors and admins read every draft; authors read published posts plus **their own** drafts and version history only (`publishedOrStaff`, `versionsOfOwnOrEditor` in `src/payload/access/index.ts`). This applies everywhere: REST, admin lists, dashboard and preview.
- **Live preview** (posts, pages, homepage; mobile 375 / tablet 768 / desktop 1280 breakpoints):
  1. The admin iframe opens `/next/preview/?collection=posts&id=<id>` (or `?global=homepage`). The link names a *document*, never a URL, so it cannot be used as an open redirect.
  2. The route refuses cross-site requests (`Sec-Fetch-Site: cross-site`, so another website cannot toggle a staff member's preview), re-authenticates the admin session (password **and** TOTP step, same `totpAccess(isStaff)` rule as the REST API), looks the document up as that user, turns on Next draft mode and redirects to the document's public path.
  3. Every page render in draft mode re-checks the admin session (`getPreviewUser`). The draft-mode cookie alone shows nothing: a copied or forged cookie, a logged-out session or a password-only session all get the published site (tested in `tests/int/preview.int.test.ts` and `tests/e2e/admin.spec.ts`).
  4. On save/autosave the admin posts a `payload-document-event` message; `LivePreviewListener` accepts it only from our own origin and parent frame and re-renders from the server (`router.refresh()`). The form data the admin also posts is ignored.
  5. Draft reads are never cached (`getPostPreview` has no cache; Next's data cache is bypassed in draft mode). Every page is dynamic, so production responses are `Cache-Control: private, no-cache, no-store` (verified on a production build). Draft-mode responses also carry `X-Robots-Tag: noindex`.
  6. Framing: pages are unframeable (`frame-ancestors 'none'`, `X-Frame-Options: DENY`) except when the draft-mode cookie is present, where only our own origin may frame them (`'self'` / `SAMEORIGIN`). The admin itself is never frameable (`DENY` + `frame-ancestors 'none'`, cookie or not).
- Staff see an orange "Preview" bar on the site while preview is on, with an **Exit preview** link (`/next/exit-preview/`, which only returns to local paths; `//host` and dot-segment tricks such as `/.//host` fall back to `/`). The link is hidden inside the admin's preview frame.

## 7. Security follow-ups and deployment checklist

| Item | Status / action |
|---|---|
| First admin account | HTTP sign-up is blocked on an empty database. Create the first admin **from the server console** (Payload Local API script) during deployment, then enrol TOTP immediately. |
| TOTP enrolment window (M2) | A new account is usable for enrolment only; provision the TOTP secret at account creation via an ops script (planned). |
| MFA lockout reset | Locks expire on their own (15 min, doubling up to 24 h). No admin UI to reset yet. |
| IP-based rate limiting | Not in the app; add at the edge (Cloudflare / App Platform) at deployment. `clientIp` in logs is informational only. |
| `totpSecret` at rest | Stored in MongoDB unencrypted (protected by DB access control + TLS). Consider field-level encryption before production. |
| Test artifacts | Playwright `test-results/` can contain page snapshots: never upload them from CI. Admin E2E runs only against localhost and never logs credentials. |
| 410 for removed demo content | Served as 404 until redirects move into the proxy (migration phase). |
| Site search | Title + summary only (no full-text index yet). |
| `undici` advisory (Payload dependency) | Pinned to the patched 7.29.1 through `overrides` in `package.json`; remove the override once Payload ships it. |
