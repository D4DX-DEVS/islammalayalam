# 04 — Admin / CMS Audit (Phase 1)

Date: 2026-10-30 · Scope: the whole Next.js + Payload application, read-only. No code, data or
configuration was changed while producing this report.

Companion document: [05-CMS-PLAN.md](05-CMS-PLAN.md) (new information architecture and the
incremental implementation plan). Nothing in the plan starts before it is approved.

---

## 1. Executive summary

The application is **not** a hand-built WordPress clone: it is **Payload CMS 3.90 running inside
Next.js 16.4**, with MongoDB (DO Managed) for data and DigitalOcean Spaces for media. The data
layer, access control and security work are solid and should be kept: deny-by-default access,
TOTP two-step sign-in with lockout and replay protection, an append-only audit log, a sandboxed
Lexical editor that cannot emit raw HTML, a media guard (magic bytes, re-encode, PDF scan) and
redirects for every legacy URL.

What feels like WordPress is the **content model and the admin shape**, which were copied from the
old site so the migration could be lossless:

- one universal "Post" type with a WordPress-style *post format* radio (article / video / audio /
  e-book) and conditional field groups, plus a hook that forces e-books into an "E-Books" category;
- the WordPress edit-screen layout — a writing column and a long right-hand column of meta boxes
  (post number, date, categories, primary category, author, featured, reading time, review flags,
  created-by, legacy reference);
- WordPress page attributes (parent, `order` integer default 100, page *template* select);
- WordPress "Appearance" concepts as globals: 3-level nested menu arrays, a homepage *sidebar*
  (widget area), ad banner arrays;
- migration information shown in everyday forms ("Legacy WordPress reference", "WordPress title
  was empty", "date looked tampered in WordPress", media SHA-256 and scan details).

The admin look has been restyled several times. Each pass was layered on top of the previous one,
so there are now **15 SCSS files (~6,900 lines)** overriding Payload's styles, with comments such as
"this file owns the look, so a screen never falls back to the old warm-paper / navy styling".
This is the main source of inconsistency and the main obstacle to a coherent design system.

Missing domains: **analytics (none exists)**, **scheduled publishing**, a **real review workflow**
(only a "needs review" checkbox), **editorial ownership** (bylines are not linked to accounts),
**media organisation** (no folders, tags or "where used"), and **outgoing email** (no adapter, so no
invitations or password-reset mail).

---

## 2. Inventory

### 2.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.4.2, React 19.2 | App Router; `(frontend)` and `(payload)` route groups |
| CMS | Payload 3.90.2 | Admin at `/admin`, REST at `/api/*`, GraphQL disabled |
| Database | MongoDB via `@payloadcms/db-mongodb` | Local dev reads the **live** `MONGODB_URI` |
| Media | `@payloadcms/storage-s3` → DO Spaces, CDN URLs | Prefix `ISLAMMALAYALAM/media` |
| Editor | Lexical (restricted feature set) | `src/payload/editor.ts` + `src/lib/security/lexical-guard.ts` |
| Auth | Payload auth + `payload-totp` + `mfaPolicy` + `totpGuard` | Sessions, lockout, 4 h tokens |
| Icons | `lucide-react` 1.48 | Already used in admin components |
| Validation | zod 4 (public forms), Payload field `validate` (admin) | Two mechanisms, see §6 |
| Tests | Vitest (54 unit, 11 integration files), Playwright (3 E2E specs) | Int/E2E pin local DBs |

### 2.2 Collections (15)

| Slug | Admin label | Group | Versions | Purpose |
|---|---|---|---|---|
| `posts` | Posts | Content | drafts + autosave, 30 | Articles, video, audio, e-books (`format`) |
| `pages` | Pages | Content | 25, no drafts | Knowledge-base tree + static pages |
| `categories` | Categories | Content | — | Topics, `/category/<slug>/` |
| `authors` | Authors | Content | — | Public bylines, `/author/<slug>/` |
| `quotes` | **Insights** | Media | — | Posters/quotes for homepage + `/insights/` |
| `audios` | Audio | Media (hidden in nav) | — | Quick audio links for homepage player |
| `videos` | Videos | Media (hidden in nav) | — | Quick video links for homepage band |
| `media` | Files and images | Media | — | Uploads (images + PDFs), 4 WebP sizes |
| `redirects` | Redirects | Advanced | — | 301/308/410, hit counter |
| `contact-messages` | Messages | Communication | — | Contact form submissions |
| `postal-requests` | Postal library | Communication | — | Postal library membership requests |
| `users` | Users | Team | — | Staff accounts, roles admin/editor/author |
| `audit-logs` | Activity log | Advanced | — | Append-only audit trail |
| `migration-runs` | Migration runs | hidden | — | WordPress import bookkeeping |
| `migration-issues` | Migration issues | hidden | — | Quarantine/rejection evidence |

### 2.3 Globals (7)

`site-settings`, `homepage` (main `layout` blocks + `sidebar` blocks), `header` (main menu 3
levels + top links), `footer`, `ads-banners` (top / bottom arrays), `security-settings` (two-step
switch), `instagram-connection` (token store).

### 2.4 Custom admin code

- Config: `src/payload.config.ts` — custom Nav, header actions (account, inbox bell, theme switch,
  global search), phone dock, custom dashboard view, `/admin/website` view, live preview, list
  defaults (toolbar + row-actions column) applied to every collection.
- Components: `src/payload/admin/**` (~60 files): dashboard (8), lists toolbar (11), nav (4),
  header (5), dock (2), website manager (7), media ordering (3), MFA (5), enhancements (4), misc.
- Styles: `src/app/(payload)/custom.scss` + 14 partials (see §5.1).
- Generated: `src/app/(payload)/layout.tsx`, `admin/importMap.js`, `src/payload-types.ts`.

### 2.5 Routes and APIs

Public (`src/app/(frontend)`): home, `[...path]` (post `/<n>/`, page tree, redirects),
`/category/[slug]`, `/author/[slug]`, `/search`, `/audios`, `/insights`, `/quote/[id]`,
`/api/ebook/[postNumber]`, `/next/preview`, `/next/exit-preview`. Root: `sitemap.ts`, `robots.ts`,
`manifest.ts`, `llms.txt`, `sw.js`, `admin.webmanifest`.

APIs: Payload REST `/(payload)/api/[...slug]`; server actions for contact and postal forms
(`src/features/postal/actions.ts`, rate-limited, honeypot, zod); AI search (`src/features/ai-search`).

### 2.6 Working-tree state

`main` has **40 modified and 3 untracked files** not yet committed (admin SCSS, header/nav,
Lexical guard, collections, tests). Any implementation must start from a committed baseline so the
two streams of work do not mix (see plan §0).

---

## 3. What is good and must be preserved

| Area | Where | Why it matters |
|---|---|---|
| Access control | `src/payload/access/index.ts` | Deny-by-default, role + completed-MFA check, author = own drafts only |
| Two-step sign-in | `payload-totp`, `src/payload/plugins/*`, `src/payload/mfa.ts` | Runtime switch, attempt limit, replay protection |
| First-user lock | `blockRemoteFirstUser` in `Users.ts` | Nobody can claim an empty install remotely |
| Content safety | `lexical-guard.ts`, `contentGuard.ts`, `mediaGuard.ts` | Legacy site was infected; new content is clean by construction |
| URL stability | `postNumber` → `/<n>/`, page `path` cascade, `redirects` | Every indexed URL keeps working |
| Malayalam handling | `normalizeSlug` (NFC, zero-width, chillu), search keys | Correct slugs and search for Malayalam |
| Public read path | `src/features/shared.ts` `PUBLIC` + tag cache | Frontend queries run as anonymous visitor |
| Audit log | `src/payload/hooks/auditLog.ts` | Who changed what, including logins and MFA lockouts |
| Nav as data | `src/payload/admin/nav/navModel.ts` | Already centralised and unit-tested — a good base |
| List toolbar | `src/payload/admin/lists/*` | Filter chips, status tabs, column menu — reusable |

---

## 4. WordPress patterns and assumptions

### 4.1 Content model

| # | Finding | Evidence | Impact |
|---|---|---|---|
| W1 | One "Post" type for four content types, chosen by a *post format* radio ("This post is…") with conditional groups | `Posts.ts` `format`, `video`/`audio`/`ebook` groups under "Media & files" | Every type shares one list, one editor, one set of columns; a video editor sees article fields. The CMS cannot treat videos or e-books as first-class |
| W2 | E-books forced into an "E-Books" category by hook | `hooks/ebook.ts`, `lib/ebook.ts` | Category used as a content-type marker (WordPress theme habit) |
| W3 | Hidden "placement-only" category kept for the old slider flag | `Categories.ts` `hidden` description | Taxonomy carries layout state |
| W4 | `postNumber` continues the WordPress ID sequence | `assignPostNumber` | **Keep** (URLs), but present it as "Post #" in technical details, not as a meta box |
| W5 | Page attributes: `parent`, integer `order` (default 100), `template` select (postal form is a "template") | `Pages.ts` | Ordering by magic numbers; a form is modelled as a page template |
| W6 | `kind: kb / static` on pages | `Pages.ts` | Two different things (knowledge base vs. site pages) share one list |
| W7 | Bylines (`authors`) are unrelated to accounts (`users`); ownership is `createdBy` | `Authors.ts`, `createdByField` | "My content", review assignment and per-author permissions cannot be expressed |
| W8 | Duplicate audio/video sources: `audios`/`videos` collections *and* audio/video posts both feed the homepage; the collections are hidden from the nav "because they are added as posts now", yet still render | `MediaLinks.ts`, `navModel.ts` `NAV_OMITTED` | Two sources of truth; editors cannot find what is on the homepage |
| W9 | `quotes` collection labelled "Insights" and filed under Media | `Quotes.ts` | Name/slug/group mismatch; "Insights" also collides with the requested Analytics wording |

### 4.2 Editing interface

| # | Finding | Evidence |
|---|---|---|
| W10 | WordPress edit-screen layout: 11 sidebar fields on posts (`postNumber`, `publishedAt`, `categories`, `primaryCategory`, `author`, `featured`, `readingMinutes`, `flags`, `createdBy`, `legacy`, …) | `admin.position: 'sidebar'` throughout `Posts.ts` |
| W11 | "Legacy WordPress reference" group shown in the sidebar of every migrated post, page, category, author and file (staff read) | `legacyFields()` in `fields/index.ts` |
| W12 | Migration review copy in ordinary forms: "Title was generated… (WordPress title was empty)", "Publish date looked tampered/invalid in WordPress" | `reviewFlags` |
| W13 | Media sidebar shows `sourceSha256` and a `security` group (kind, re-encoded, scannedAt) | `Media.ts` |
| W14 | "Edit · Delete" row-actions column and All / Published / Drafts tabs above every list | `RowActions.tsx`, `StatusTabs.tsx` |
| W15 | Menus as nested repeater arrays (main menu → children → children, up to 14 × 40 × 40), folded because "all open, the page was ~24,000 px long" | `globals/menus.ts` |
| W16 | Homepage "Sidebar sections" block list (a widget area) next to the main layout | `globals/index.ts` `Homepage.sidebar` |
| W17 | Confirmation dialogs on Save / Publish / Force unlock everywhere | `enhancements/confirmRules.ts` |

### 4.3 Workflow assumptions

| # | Finding | Evidence |
|---|---|---|
| W18 | Publishing = Payload `_status` only. No "in review" state, no reviewer, no approval | `authorCannotPublish` throws; authors can only set the `needsReview` checkbox |
| W19 | No scheduled publishing. A future `publishedAt` is still public, because public reads only check `_status: published` | `features/posts/queries.ts`, `access/index.ts` `publishedOrStaff` |
| W20 | Version history only on posts and pages; categories, authors, globals (homepage, menus, settings) have none | collection configs |
| W21 | Draft autosave every 3 s. Memory/history notes junk "(untitled)" drafts created by opening the New post screen; `versions.drafts.validate: true` is now set — needs verification on a test DB, plus cleanup of existing junk drafts (#5461–#5465 and later) by an editor | `Posts.ts`, dashboard Drafts count |

---

## 5. Design and implementation debt

### 5.1 Layered stylesheets

`custom.scss` loads 14 partials in this order: `admin-theme` (537) → `admin-nav` (307) →
`admin-dashboard` (1,382) → `admin-website` (385) → `admin-header` (447) → `admin-security` (149)
→ `admin-dialog` (124) → `admin-modern` (200) → `admin-refresh` (824) → `admin-chrome` (564) →
`admin-dock` (335) → `admin-menu-sheet` (325) → `admin-lists` (810) → `admin-system` (318,
untracked), plus `custom.scss` itself (157). Total ≈ **6,900 lines**.

- Successive redesigns ("theme", "modern", "refresh", "chrome", "system") override each other;
  `admin-system.scss` states it exists so that screens "never fall back to the old warm-paper /
  navy styling" — i.e. the earlier rules are still there and still compete.
- Proof of drift: `(payload)/layout.tsx` still sets the light `themeColor` to `#f4f3ef` (old warm
  paper) while the current canvas token is `#f9fafb`.
- Rules target Payload's internal class names (`.collection-list .table`, `.doc-header__title`,
  …). Every Payload upgrade can silently break them.

### 5.2 File organisation

- Dashboard logic is split between `admin/dashboardData.ts` (497 lines), `admin/dashboardStats.ts`
  and `admin/dashboard/*`; website manager between `admin/websiteData.ts`, `websiteModel.ts`,
  `websiteBlocks.ts`, `adsSummary.ts` and `admin/website/*`. No consistent "module folder" rule.
- There is no shared admin UI kit: panels, page headers, badges, empty states and buttons are
  re-implemented per screen in TSX + SCSS.

### 5.3 Duplicate implementations

| Duplicate | Locations |
|---|---|
| "optional https link" validator | `validateHttps` (Posts.ts), `validateOptionalHttps` (fields), `httpsOnly` (globals) |
| YouTube link validator | `validateVideo` (Posts.ts), `validateYouTubeLink` (fields) |
| Two ordering mechanisms on the same lists | Payload `orderable` drag handles **and** custom `MoveArrows` + `ListOrderHint` |
| Audio/video entries | `audios`/`videos` collections and audio/video posts (W8) |
| Admin vs. public validation | Payload `validate` functions in configs; zod in `features/postal/schema.ts` |

---

## 6. Hardcoding

| Item | Where | Recommendation |
|---|---|---|
| Content formats (`standard/video/audio/ebook`) and their labels | ≥ 10 files: `Posts.ts`, `dashboardData.ts` (`FormatKey`), `websiteBlocks.ts`, `websiteModel.ts`, `blocks/homepage.ts`, `sectionNames.ts` (`MEDIA_FORMAT`), `lib/ebook.ts`, `hooks/ebook.ts`, frontend components | One content-type registry |
| Site name `'Islam Malayalam'` | `payload.config.ts`, `app/manifest.ts`, `globals/index.ts` default | Constant module (config cannot read the DB at build time) |
| Time zone `'Asia/Kolkata'` | 4 files | One constant |
| Status options | `contact-messages` uses raw strings `new/read/replied/spam` (no labels); `postal-requests` uses `STATUSES` + labels; `redirects.source` raw strings | One status-definition helper |
| Permission choices | Each collection picks helpers ad hoc — e.g. `quotes` delete = admin, `videos` delete = editor, `contact-messages` delete = admin, `media` delete = editor | A role × capability matrix that both access control and UI read |
| Row-actions slugs | `ROW_ACTIONS` set in `payload.config.ts` | Derive from the registry |
| Group names | `admin.group` on each config **and** `NAV_GROUP_LABELS` (kept in step by tests) | Single source |
| Inbox badge slugs | `WAITING` in `nav/navData.ts` | Registry flag |
| Long help texts | Inline strings in configs, English only | Acceptable; centralise only where reused |

Not everything needs to move: the nav model, section names and file policy are already centralised
and tested, and should be extended rather than replaced.

---

## 7. Migration data exposed to administrators

| Data | Shown today | Should be |
|---|---|---|
| `legacy.wpId`, `legacy.legacyUrls` | Sidebar group on every migrated document | Collapsed "Technical details" section, admins only |
| `legacy.legacySlugs`, `sourceHash`, `migratedAt` | Hidden (internal) | Same, admins only |
| `flags.titleDerived`, `flags.dateSuspect` | Sidebar with WordPress wording | Shown only when set, as a neutral "Check this" notice |
| Media `sourceSha256`, `security.*` | Sidebar | Technical details |
| `migration-runs`, `migration-issues` | Hidden from nav, reachable by URL | Admin → Technical → Migration records |
| "Legacy" filters in list "Add filter" | Under Advanced | Admin-only |

All of this stays in the database unchanged.

---

## 8. Domain-by-domain assessment

| Domain | Exists | State | Gaps |
|---|---|---|---|
| Articles / Videos / Audio / E-books | As `posts.format` | Works | No per-type views, create flows, columns or validation (a video post can be saved without a video link) |
| Drafts | Yes | Works | Junk drafts (W21) |
| Review workflow | Checkbox + note | Minimal | States, reviewer, request/approve actions, notifications |
| Publishing & scheduling | Publish only | — | Scheduling (W19) |
| Version history | Posts, pages | Payload default UI | Globals/categories/authors; compare/restore UX |
| Pages | Yes | Works | KB vs site pages mixed; ordering by numbers; tree view |
| Homepage builder | Blocks in a global + Website manager view | Works, two screens | One builder with live preview |
| Header / navigation | Nested arrays | Works | Tree editor, depth clarity |
| Footer | Global | Works | — |
| Banners | Global arrays | Works | Scheduling, placement overview |
| Site configuration | `site-settings` | Works | — |
| Categories | Yes | Works | Mixed with layout flags (`hidden`, `showInStrip`, `icon`) |
| Authors | Yes | Works | No account link, no profile completeness |
| Editorial team | Users + role | Basic | Team page, ownership, assignments |
| Media library | Payload upload list | Works | Grid/DAM view, folders/tags, where-used, alt-text queue (migration: 607/612 legacy images had no alt) |
| Video / audio assets | Links only (audio uploads refused by policy) | By design | — (keep) |
| Insights | `quotes` | Works | Naming (W9) |
| Messages | Yes | Raw statuses | Reply workflow, assignment, labels |
| Postal library | Yes | Works | Shared inbox UI with Messages |
| Analytics | **No** | — | Page views, popular content, read time, category performance — nothing is collected. Only publishing counts, redirect hits and audit-log activity exist |
| Users / roles | 3 roles | Works | Invitations, password reset mail (no email adapter configured), role descriptions, session list |
| Auth security | Strong | Works | Admin UI to see lockouts/sessions |
| System / technical tools | Redirects, activity log | Works | Group under one Technical area with migration records |

---

## 9. Risks and constraints for the redesign

1. **Local dev writes to production.** `npm run dev` uses the live `MONGODB_URI` and Spaces.
   Every CRUD test, Playwright run and screenshot pass must use a local database (`seed:dev`
   pins `mongodb://127.0.0.1:27017/islammalayalam_dev`); otherwise testing pollutes or damages
   live content. Opening any `/create` URL can write a draft.
2. **Payload internals.** Restyling through Payload's private class names breaks on upgrade.
   The redesign should use Payload's supported extension points (custom views, field/cell
   components, `admin.components`) and CSS cascade layers, not deeper overrides.
3. **Public URLs and SEO.** `postNumber`, page `path`, category/author slugs, redirects, sitemap,
   canonical tags must not change. All proposed content-type changes are views over the existing
   `posts` collection, not new collections.
4. **Publishing behaviour.** Scheduling and review states change behaviour and need explicit
   approval; they must be additive (existing published posts stay published).
5. **Uncommitted work.** 43 files in the working tree. Commit or shelve before starting.
6. **Generated files.** `layout.tsx` and `importMap.js` are Payload-generated; changes go through
   config + `generate:importmap`.
7. **Next.js 16 / Payload 3.90 APIs** differ from older docs; read `node_modules/next/dist/docs/`
   and Payload's own docs before each module.

---

## 10. How this audit was done

Read-only review of `src/payload.config.ts`, every collection, global, field helper, hook and access
helper, the admin component tree, the SCSS partials, frontend route tree and feature queries,
package scripts and the test inventory. No browser session was opened against the admin, because the
dev server reads the live database and admin sign-in needs the user's credentials and TOTP.
Visual baselines will be captured against a local seeded database in plan step 0.
