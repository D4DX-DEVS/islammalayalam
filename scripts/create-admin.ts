/**
 * First admin — `npm run create-admin`. Runs against the database in .env (MONGODB_URI).
 * The admin UI refuses to create the first account (blockRemoteFirstUser), so it is made here
 * through the Local API. Refuses to run once any user exists; later accounts are added by an
 * admin under Admin → Users. TOTP is set up in the browser on first login (forceSetup).
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD (or DEV_ADMIN_*) in .env, or are asked for interactively.
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { getPayload } from 'payload'
import config from '@payload-config'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs > 0) {
    console.error(`Refusing: ${totalDocs} user(s) already exist. Add more under Admin → Users.`)
    process.exit(1)
  }

  const env = process.env
  const email = (
    env.ADMIN_EMAIL ||
    env.DEV_ADMIN_EMAIL ||
    (await ask('Admin email: '))
  )
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
  const name = env.ADMIN_NAME || ''
  const password =
    env.ADMIN_PASSWORD || env.DEV_ADMIN_PASSWORD || (await ask('Password (12+ chars): '))
  if (!email) throw new Error('No email: set ADMIN_EMAIL in .env (and save the file)')
  if (!EMAIL_RE.test(email))
    throw new Error('ADMIN_EMAIL is not a valid email (no quotes, spaces or trailing characters)')
  if (password.length < 12) throw new Error('Password must be at least 12 characters')

  await payload.create({
    collection: 'users',
    data: { email, password, name: name || undefined, role: 'admin' },
    overrideAccess: true,
    context: { actor: 'create-admin' },
  })
  console.log(`Admin created: ${email}. Log in at /admin and finish TOTP setup.`)
  process.exit(0)
}

// Top-level await: `payload run` exits as soon as this module finishes evaluating.
try {
  await main()
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
