# WordPress → Payload migration

Moves the legacy IslamMalayalam.net content into the new CMS. It is repeatable and idempotent:
every record is upserted by its WordPress id, and a record whose computed data has not changed
since the last run is left alone.

## Run it

```bash
npm run migrate -- target=local                 # full local run
npm run migrate -- target=local limit=20        # first 20 posts only (smoke test)
npm run migrate -- target=local dry-run         # count only; nothing written or downloaded
npm run migrate -- target=local concurrency=4   # parallel media downloads (1–8, default 3)
```

`payload run` drops `--flags`, so options are plain words (`key=value`, `dry-run`, `apply`,
`overwrite-edited`). Any unknown word stops the run, so a typo can never be silently ignored.

- **Production is a dry run by default.** It writes only with `confirm=i-understand-this-writes-to-production`
  **and** `apply`.
- **Editors' changes win.** A record saved in the CMS after the migration wrote it is left alone
  and reported. The word `overwrite-edited` replaces such records; use it only deliberately.

| Target            | Writes to                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `local` (default) | the local MongoDB server (`mongodb://127.0.0.1:27017`), database `islammalayalam_migration`, files in `./media-migration/`. The live `MONGODB_URI` / `DO_SPACES_*` are switched off. |
| `production`      | `MONGODB_URI` + DigitalOcean Spaces (`DO_SPACES_*`) — the same settings the app uses. Refused unless the extra word `confirm=i-understand-this-writes-to-production` is given.       |

The target settings are applied before the Payload config loads. Credentials are never printed.
Error output is redacted (`lib/redact.ts`).

## Where the data comes from

- Text and records come from the sanitized audit snapshot `audit/data/wp/*.json`, never from the
  live site. Every string is cleaned again on load (`lib/snapshot.ts`).
- Files are fetched from `https://islammalayalam.net/wp-content/uploads/…` only. They are held in
  memory and never written to disk as downloaded.

## Gates

| Gate        | Where                                 | What                                                                                                                                                                            |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — source  | `gates/html.ts`                       | audit sanitizer → sanitize-html allowlist → indicator scan. A record with an indicator left is **rejected**.                                                                    |
| B — files   | `load/media.ts` + the CMS media guard | own uploads only; no redirects; 80 MB cap; magic bytes checked against JPEG/PNG/GIF/WebP/PDF; images re-encoded into new files; PDFs scanned. Anything else is **quarantined**. |
| C — content | the CMS content guard                 | the converted Lexical document must validate, or the post is **rejected**.                                                                                                      |

Rejected and quarantined items are never stored. They are listed in the report and in the
`migration-issues` collection.

## What happens to the content

- Demo posts from the theme (categories 254–260, 264–269) are excluded.
- The `slider` category becomes the post's "featured" flag.
- Posts keep their number, so `/<id>/` still works. The old slug is kept for redirects.
- HTML becomes Lexical. Links to the old site become new paths, so no link leads back to the
  WordPress install. YouTube frames become video blocks. Links to stored files become site paths,
  or the https CDN address in production.
- **Outbound links go only to approved sites** (`APPROVED_LINK_HOSTS` in `lib/exclusions.ts`).
  These are youtube.com, youtu.be, docs.google.com, facebook.com and islamonlive.in, reviewed from
  the full link list. Everything else is removed and its text kept:
  - dead hosts
  - spam (the essay-writing links injected in the earlier hack)
  - redirect and short-link services
  - links that carry another address in their query
  - localhost

  Removed links are reported per page. Extend the list only after review.

- Empty titles are generated from the first sentence. For "Question: … Answer: …" posts, the
  question is used. Tampered dates are estimated from nearby posts. Both are flagged `needsReview`
  so an editor can check them.
- A video post takes its first YouTube embed, or else the first YouTube link written in its text.
  Video and audio links kept in an old WordPress plugin could not be recovered, so those posts are
  flagged too.
- Pages: WPBakery shortcodes become the page body plus tabbed sections. Builder layout and
  sub-menus are dropped, because a page lists its own sub-pages. Raw-HTML blocks are never
  migrated. There are 102 knowledge-base pages and 4 static pages. The 34 theme demo pages are
  not migrated.
- Redirects: demo pages, posts and categories are marked 410 Gone (the site serves 404 until
  redirects move into the proxy). `/category/slider/` goes to the homepage.
- Menus, homepage and footer are built from the original menu only while the header menu is
  still empty. Once editors have set them, a re-run never overwrites them.

## Stages

categories → author → media (parallel) → pages → posts → redirects → globals → local review
admin (local only) → **Gate C verification**.

A failed write is tried once more (`lib/retry.ts`). Payload checks a post's file fields in parallel
inside one MongoDB transaction and now and then loses that race; the transaction is rolled back,
so the second try is safe. A real error fails twice and is reported.

Verification reads back what is stored:

- counts
- a malware-indicator scan of every document
- the content guard on all rich text
- file references
- internal links
- outbound links: none to the old site, none through redirect services, approved sites only, https only

A failed security check marks the run failed. The report lists every outside site that is still
linked.

## Output

- `docs/migration/<target>-run-latest.md`: counts, the verification table and every issue, by id
  (no content).
- `migration-runs` and `migration-issues` collections in the target database.

## Review a local run

```bash
npm run dev:migration   # the dev server (port 3444) on the migration database; use instead of `npm run dev`
```

- Admin login: `migration-review@islammalayalam.net`, with the password from
  `MIGRATION_ADMIN_PASSWORD` in `.env` (generated on the first local run). The authenticator code
  is the same as the dev admin's.
- `dev:migration` starts with an empty data cache, because a migration run writes straight to the
  database. Restart it after each run.
- Stop it and run `npm run dev` to go back to the seed data.
