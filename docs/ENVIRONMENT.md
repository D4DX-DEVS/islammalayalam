# Environment variables

Validated at startup by `src/lib/env.ts` (zod). The app refuses to start if anything is invalid.
Production values live **only** in DigitalOcean App Platform environment variables (encrypted) —
never in the repository, never in chat. Locally they live in `.env` (gitignored).

| Variable | Required | Example (dev) | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | `development` / `test` / `production` |
| `DATABASE_URL` | yes | `mongodb://127.0.0.1:27017/islammalayalam_dev` | Non-production refuses a non-local host unless `ALLOW_REMOTE_DB=true` |
| `PAYLOAD_SECRET` | yes | 48 random bytes, base64url | ≥ 32 chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SERVER_URL` | yes | `http://localhost:3444` | Canonical origin; also the only CSRF/CORS origin |
| `ALLOW_REMOTE_DB` | no | `false` | Deliberate override for non-production |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | prod | — | DigitalOcean Spaces. All five or none. Non-production refuses them unless `ALLOW_REMOTE_MEDIA=true` |
| `MEDIA_CDN_URL` | prod | `https://<bucket>.<region>.cdn.digitaloceanspaces.com` | When set, media URLs point straight at the CDN |
| `ALLOW_REMOTE_MEDIA` | no | `false` | Deliberate override for non-production |
| `TOTP_DISABLED` | no | `false` | Accepted **only** with `NODE_ENV=test` (integration tests) |
| `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` | dev | generated | Used by `npm run seed:dev` and the local admin E2E only. Must pass the CMS rules: a valid email address and a password of 12+ characters |
| `DEV_ADMIN_TOTP_SECRET` | dev | generated | The dev admin's TOTP secret, so the admin E2E can sign in. Local only; never set in production |
| `MIGRATION_ADMIN_PASSWORD` | dev | generated | Password of the local review admin (`migration-review@islammalayalam.net`) in the local migration database. Written by the first local migration run |
| `MONGODB_URI` `DO_SPACES_BUCKET` `DO_SPACES_ENDPOINT` `DO_SPACES_KEY` `DO_SPACES_SECRET` `DO_SPACES_CDN_ENDPOINT` `DO_SPACES_FOLDER` | migration | — | Production target of `npm run migrate -- target=production` only (see `migration/README.md`). The app never reads these names. `MONGODB_URI` must include the database name |

Local `.env` was generated with random values; to regenerate, delete it and create a new one with
the variables above.

The dev server runs on **port 3444** (`npm run dev`), so `NEXT_PUBLIC_SERVER_URL` must be
`http://localhost:3444` locally (it is the admin's CSRF/CORS origin and the live-preview origin).
