/**
 * LOCAL DEV ONLY: prints the local dev admin's current two-step code, so signing in to `npm run dev`
 * needs no authenticator app. The account and its secret (DEV_ADMIN_TOTP_SECRET in .env) are made by
 * `npm run seed:dev` and exist only in the local database; live accounts are never in .env.
 *
 *   npm run dev:code
 */
import { TOTP } from 'otpauth'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env: the check below explains what to do.
}

const secret = process.env.DEV_ADMIN_TOTP_SECRET
if (!secret) {
  process.stderr.write('DEV_ADMIN_TOTP_SECRET is not in .env yet. Run `npm run seed:dev` first.\n')
  process.exit(1)
}

const code = new TOTP({ secret, digits: 6, period: 30, algorithm: 'SHA1' }).generate()
const left = 30 - (Math.floor(Date.now() / 1000) % 30)
const who = process.env.DEV_ADMIN_EMAIL ?? 'the dev admin'
process.stdout.write(`Two-step code for ${who}: ${code}  (valid for ${left} more seconds)\n`)
