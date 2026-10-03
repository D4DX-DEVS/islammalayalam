# Environment variables

Validated at startup by `src/lib/env.ts` (zod). The app refuses to start if anything is invalid.
Production values live **only** in DigitalOcean App Platform environment variables (encrypted) —
never in the repository, never in chat. Locally they live in `.env` (gitignored).

| Variable | Required | Example (dev) | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | `development` / `test` / `production` |
| `MONGODB_URI` | yes | `mongodb+srv://…/islammalayalam?…` | The database, **locally and in production** (owner decision 2026-10-03). Must include the database name. `NODE_ENV=test` refuses a non-local host |
| `PAYLOAD_SECRET` | yes | 48 random bytes, base64url | ≥ 32 chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SERVER_URL` | yes | `http://localhost:3444` | Canonical origin; also the only CSRF/CORS origin |
| `DO_SPACES_BUCKET` `DO_SPACES_ENDPOINT` `DO_SPACES_KEY` `DO_SPACES_SECRET` | yes (media) | endpoint `blr1.digitaloceanspaces.com` | DigitalOcean Spaces, locally and in production. All four or none (none = files in `./media`). The region comes from the endpoint. `NODE_ENV=test` refuses them |
| `DO_SPACES_CDN_ENDPOINT` | yes (media) | `<bucket>.blr1.cdn.digitaloceanspaces.com` | Host or https URL. Media URLs point straight at the CDN. Must also be set at **build** time (App Platform: scope "build and run"): `next.config.ts` bakes it into the image allowlist. After changing it locally, restart `npm run dev` |
| `DO_SPACES_FOLDER` | no | `ISLAMMALAYALAM` | Folder inside the bucket; files go to `<folder>/media/…` |
| `TOTP_DISABLED` | no | `false` | Accepted **only** with `NODE_ENV=test` (integration tests) |
| `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` | dev | generated | Used by `npm run seed:dev` and the local admin E2E only. Must pass the CMS rules: a valid email address and a password of 12+ characters |
| `DEV_ADMIN_TOTP_SECRET` | dev | generated | The dev admin's TOTP secret, so the admin E2E can sign in. Local only; never set in production |
| `MIGRATION_ADMIN_PASSWORD` | dev | generated | Password of the local review admin (`migration-review@islammalayalam.net`) in the local migration database. Written by the first local migration run |

**`npm run dev` works on the live data.** Pages show the production database and the Spaces CDN,
and anything saved or uploaded in the local admin changes the live site.

Tests and dev tools never use the live values; they pin their own local databases:

| Tool | Database | Media |
|---|---|---|
| Integration tests (`npm run test:int`) | `islammalayalam_test` (`tests/int/env.ts`) | `.test-media/` |
| E2E (`npm run test:e2e`) — starts its own dev server, never reuses a running one | `islammalayalam_dev` (`playwright.config.ts`) | `./media` |
| `npm run seed:dev` | `islammalayalam_dev` (`package.json`) | `./media` |
| `npm run migrate` (`target=local`) / `npm run dev:migration` | `islammalayalam_migration` | `./media-migration/` |

Older names (`DATABASE_URL`, `S3_*`, `MEDIA_CDN_URL`, `ALLOW_REMOTE_DB`, `ALLOW_REMOTE_MEDIA`)
are no longer read and can be deleted from `.env`.

The dev server runs on **port 3444** (`npm run dev`), so `NEXT_PUBLIC_SERVER_URL` must be
`http://localhost:3444` locally (it is the admin's CSRF/CORS origin and the live-preview origin).
