# 05 — New CMS Architecture and Implementation Plan (Phases 2–8)

Date: 2026-10-30 · Status: **proposal, awaiting approval.** Based on
[04-CMS-AUDIT.md](04-CMS-AUDIT.md); finding IDs (W1…W21) refer to that report.

---

## 1. Core decision: keep Payload as the engine, replace the experience

**Recommendation:** keep Payload for data, access control, versions, auth, uploads and the REST
API, and rebuild the admin *experience* on top of it with Payload's supported extension points
(custom views, custom field / cell / list components, document tabs, providers) and a new design
system.

| Option | Pros | Cons |
|---|---|---|
| **A. Payload engine + new admin experience (recommended)** | Keeps every access rule, hook, TOTP, version history, audit log and API; no data migration; incremental and reversible per module | Some Payload screens (e.g. the version diff) stay Payload-shaped unless replaced with a custom view |
| B. Fully custom Next.js admin talking to Payload's Local API | Total UI freedom | Re-implements forms, validation, drafts, autosave, locking, upload, live preview, permissions UI; months of work; high regression risk on a live site |
| C. Restyle only | Cheap | That is what produced the current 15 layered stylesheets; does not fix the content model |

Everything below assumes option A.

---

## 2. Information architecture

### 2.1 Sidebar (collapsible, grouped by job)

```
Home                         Dashboard (today's work + key numbers)
─ Content
  All content                every posts doc, any format
  Articles · Videos · Audio · E-books     format views of `posts` (W1)
  Pages                      site pages (kind = static)
  Knowledge base             KB tree (kind = kb) (W6)
  Review                     items waiting for review / assigned to me
─ Library
  Media                      images + documents, grid view
  Insights                   `quotes` (name kept for the public /insights/ section)
─ Inbox
  Messages                   contact-messages
  Postal library             postal-requests
─ Website
  Overview                   current Website manager
  Homepage                   homepage builder (layout + sidebar + quick audio/video lists, W8)
  Navigation                 header
  Footer                     footer
  Banners                    ads-banners
  Settings                   site-settings
─ Editorial
  Categories · Authors · Team
─ Analytics                  new (§4.5)
─ Administration (admin role)
  Users & roles · Security (two-step, lockouts) · Redirects · Activity log
  Technical → Migration records, legacy references, Instagram connection
```

Format views (Articles, Videos, …) are the same `posts` list opened with a preset filter and their
own columns; "New video" opens the editor with `format=video` preset. **No new collections, no
data movement, URLs unchanged.**

### 2.2 Central registries (Phase 5 — only where they remove real duplication)

| Module | Replaces | Read by |
|---|---|---|
| `src/cms/content-types.ts` — key, labels, icon, format value, required media field, list columns/filters, homepage shelf name | Format literals in ≥ 10 files (§6 of audit) | Posts config, nav, dashboard, lists, website model, homepage blocks, frontend |
| `src/cms/permissions.ts` — role × capability matrix (`content.publish`, `content.delete`, `inbox.read`, …) | Ad-hoc helper choices per collection | Access helpers (unchanged semantics), nav, row actions, dashboard |
| `src/cms/statuses.ts` — status sets with labels and tones | Raw `new/read/replied/spam`, postal labels, redirect source | Collections, list badges, inbox |
| `src/cms/site.ts` — site name, time zone, locale | `'Islam Malayalam'`, `'Asia/Kolkata'` literals | Config, manifest, dashboard, dates |
| `src/payload/fields/validators.ts` | The duplicate https / YouTube validators | All configs |
| Nav model (existing `navModel.ts`) | Extended, not replaced | Sidebar, dock, menu sheet |

Each registry change must be proven behaviour-neutral first: the same access results, the same
saved data shape (tests compare before/after).

---

## 3. Design system (Phase 3)

- **Tokens** in one file (`admin/tokens.scss`): colour (light + dark), type scale, spacing (4 px
  grid), radius, elevation, motion. Malayalam-capable font stack kept from `lib/admin-fonts.ts`.
- **Cascade layers**: `@layer payload-default, im-base, im-components, im-modules;` so our rules win
  without `!important` and without deep selectors into Payload internals.
- **Admin UI kit** (`src/payload/admin/ui/`): `PageHeader`, `Panel`, `Toolbar`, `Button`,
  `IconButton`, `Badge/StatusPill`, `EmptyState`, `StatCard`, `Inspector` (right-hand detail
  pane), `Menu/Dropdown`, `Skeleton`. Lucide icons only.
- **Shell**: collapsible sidebar (icon rail ↔ full), command palette (existing GlobalSearch,
  Ctrl+K), breadcrumbs, phone dock kept.
- **Replace, don't add**: the 15 SCSS partials are consolidated module by module into
  `tokens + base + components + one file per module`. A module is done only when its old rules are
  deleted. Target: under 2,500 lines in total.
- Visual direction: calm editorial SaaS — neutral canvas, white sheets, hairline separators, one
  accent colour, dense but readable tables, no decorative shadows. Reference products (Linear,
  Sanity) inform interaction patterns only.

---

## 4. Module designs (Phase 6)

### 4.1 Content listing (all formats)
Toolbar (search, status tabs, filter chips, column menu — existing components restyled) · rows
with thumbnail, title, format icon, status pill, category, author, updated/published date · bulk
actions bar on selection · row "⋯" menu instead of the Edit/Delete column (W14) · empty states per
format.

### 4.2 Content editor
- **Canvas** (left, wide): title, summary, featured image, body — and the one format-specific
  block at the top (YouTube link for video, Spotify/hosted link for audio, PDF for e-book),
  instead of a hidden "Media & files" tab (W1).
- **Inspector** (right, collapsible sections): *Publishing* (status, schedule, reviewer) ·
  *Organisation* (categories, primary category, author, featured) · *Search & sharing* (existing
  SEO group) · *Technical details* (collapsed, admin only: post #, created by, reading time,
  legacy reference, hashes) (W10–W13).
- Migration flags shown only when set, as a neutral "Check the date / title" notice (W12).
- Per-format required checks (a video needs a valid video link before publish).
- Implemented with Payload field config (collapsibles, conditions, `admin.components.Field`), not a
  custom form engine. Saved data shape unchanged.

### 4.3 Review, publishing and scheduling (behaviour change — needs approval)
- Additive fields on `posts`: `review.state` (`none / requested / changes-requested / approved`),
  `review.assignee` (user), `review.requestedAt`. Existing `flags.needsReview` mapped into it,
  not deleted.
- Authors get "Request review"; editors get "Approve & publish" / "Request changes".
- Scheduling via Payload's built-in `versions.drafts.schedulePublish` + jobs queue. A scheduled
  post stays a draft until the job publishes it, so **no public-query change** and no risk to the
  10 migrated posts with suspect dates. Requires a job runner on DO App Platform (`jobs.autoRun`
  in the web process, or a small scheduled worker) — decision below.
- Version history: enable versions on `homepage`, `header`, `footer`, `ads-banners`,
  `site-settings`, `categories`, `authors` (additive `_versions` collections).

### 4.4 Pages, categories, authors, team
- Pages: tree view (drag to re-parent/re-order, writes the same `parent` / `order` fields), KB and
  site pages as two views of one collection (W5, W6).
- Categories: list + inline order; layout-only flags (`showInStrip`, `icon`, `hidden`) grouped as
  "Homepage display".
- Authors: optional `account` relationship to `users` (additive) → "My content", ownership,
  assignment (W7). Bylines remain public-only, no account data exposed.
- Team: users with role descriptions, last sign-in, two-step status.

### 4.5 Analytics (new — needs approval)
Nothing is collected today. Proposed first-party, privacy-preserving collection:
- `POST /api/metrics` (server route, rate-limited, same-origin only, no cookies, no IP or
  user-agent stored, bots and staff sessions skipped, honours `Do-Not-Track`).
- Client beacon on post / page views sends path, content id, referrer host, and engaged seconds
  (`visibilitychange` / `pagehide`).
- Storage: one additive collection of **daily aggregates** per content item (`views`,
  `engagedSeconds`, `referrers{}`), not raw events, so it stays small and holds no personal data.
- Screens: overview (views, engaged time, trend), popular content, category performance, publishing
  activity (from existing data), referrers. Dashboard gets the top numbers.
- Alternative: a self-hosted tool (Umami/Plausible) — more features, another service to host and
  secure, a third-party script under the CSP.

### 4.6 Media library
Grid/list toggle, type filter (images / PDFs), search by name/alt/caption, alt-text queue
("needs description"), where-used panel (posts/pages/globals referencing the file, computed on
demand), bulk upload (already enabled), Payload folders (additive `payload-folders` collection) —
technical fields moved to Technical details.

### 4.7 Inbox (Messages + Postal library)
One inbox layout: list pane + reading pane, status pills from the status registry, internal notes,
"mark as …" actions, unread counts (existing badges). Submitted fields stay locked.

### 4.8 Website
Overview (existing manager, restyled) → Homepage builder (sections list + live preview side by side,
show/hide, reorder, quick audio/video lists moved here from hidden collections) → Navigation (tree
editor over the same nested data) → Footer → Banners (placement overview, active toggle) → Settings.

### 4.9 Administration
Users & roles (permission matrix view, read-only from `permissions.ts`), Security (two-step switch,
locked accounts with unlock), Redirects, Activity log with filters, Technical (migration records,
legacy lookup by old URL / WordPress id, Instagram connection). Outgoing email (invitations,
password reset) needs an email adapter — decision below.

---

## 5. Implementation plan

Each step is a separate, reviewable commit series. A step is complete only after the full
verification gate (§6) passes. Steps 1–2 change no visible behaviour.

| Step | Scope | DB impact | Est. size |
|---|---|---|---|
| **0. Baseline** | Commit/shelve the current 43-file working tree; record test + lint + typecheck baseline; start local Mongo + `seed:dev`; Playwright admin login against the **local** DB; screenshot every admin screen (no `/create` URLs on live data) | None | S |
| **1. Registries** | content-types, statuses, site constants, validators dedupe; config reads them; tests prove identical config output (field shapes, access results) | None | M |
| **2. Permissions matrix** | `permissions.ts` + access helpers built from it; access integration tests unchanged and green | None | M |
| **3. Design system + shell** | Tokens, layers, UI kit, collapsible sidebar, header; delete superseded SCSS; new IA in the nav model | None | L |
| **4. Content list + editor** | Format views, create presets, inspector, technical-details section, per-format checks, junk-draft verification | None | L |
| **5. Pages, categories, authors, team** | Tree view, author↔account link | Additive field | M |
| **6. Media library** | Grid view, alt queue, where-used, folders | Additive collection (folders) | M |
| **7. Inbox** | Shared inbox UI, status registry | None | M |
| **8. Website modules** | Overview, homepage builder, navigation tree, footer, banners, settings; move quick audio/video lists | None | L |
| **9. Review + scheduling** *(approval)* | Review fields, actions, schedule publish + job runner, versions on globals | Additive fields + `_versions` | L |
| **10. Analytics** *(approval)* | Metrics route, beacon, aggregates, analytics screens, dashboard numbers | Additive collection | L |
| **11. Administration** | Users/roles, security, technical area, email adapter *(approval)* | None | M |
| **12. Cleanup + docs** | Remove dead components/styles, update `03-ARCHITECTURE.md`, admin guide | None | S |

Order rationale: foundations first (1–3) so every later module is built once with the final
components; behaviour changes (9–10) last and behind approval.

---

## 6. Verification gate (after every step)

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:unit` and `npm run test:int` (local DB only)
4. Relevant Playwright specs against a **local seeded DB**: sign-in (incl. two-step), CRUD for the
   touched module, role checks (admin / editor / author), public routes still render
5. Responsive check at 375 / 768 / 1280 px, light and dark
6. Malayalam rendering: titles, slugs, search, editor input, list cells
7. Public site smoke: home, a post `/<n>/`, a KB page, category, author, search, sitemap, a
   legacy redirect
8. Screenshots compared with the step-0 baseline
9. Code review pass; findings rated CRITICAL/HIGH fixed before the next step

No step runs Playwright, CRUD or migrations against the production database.

---

## 7. Non-negotiables (from the brief, mapped to controls)

| Requirement | Control |
|---|---|
| No content deleted, no DB reset | Only additive schema; no destructive scripts; local-DB testing |
| Migration metadata kept | `legacy.*`, `flags.*`, migration collections untouched — only *where* they show changes |
| Public routes / media URLs / SEO | No change to `postNumber`, `path`, slugs, redirects, storage prefix; public smoke in every gate |
| Publishing behaviour | Unchanged until step 9, which is opt-in |
| Auth and authorisation | Access helpers keep semantics; `access.int.test.ts` + `mfa.int.test.ts` in every gate |
| Malayalam | Slug normaliser and search keys untouched; rendering check in every gate |

---

## 8. Decisions needed before starting

1. **Approach** — Payload engine + new admin experience (recommended) vs. a fully custom admin.
2. **Working tree** — commit the current 43 uncommitted files as-is before step 0, or review them
   first?
3. **Test database** — OK to run a local MongoDB (`seed:dev`, `127.0.0.1:27017`) for all CRUD and
   Playwright testing? Needs MongoDB installed locally, or `mongodb-memory-server` as a dev
   dependency.
4. **Review workflow + scheduling (step 9)** — approve the states in §4.3? Job runner: inside the
   web process (`jobs.autoRun`, simplest) or a separate DO worker?
5. **Analytics (step 10)** — first-party aggregates (recommended) or self-hosted Umami/Plausible?
6. **Email (step 11)** — which provider for invitations and password reset (SMTP, Resend,
   Postmark…), or skip for now?
7. **Admin language** — English only, or Malayalam admin labels too (Payload i18n)?
