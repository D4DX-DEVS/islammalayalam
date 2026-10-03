import { randomBytes } from 'node:crypto'
import { appendLocalEnv } from '../../scripts/dev/guard'
import type { Run } from '../lib/run'
import { LOCAL_MIGRATION_DB } from '../lib/target'

/** Login of the local review admin (a local database only; not a real mailbox). */
export const REVIEW_ADMIN_EMAIL = 'migration-review@islammalayalam.net'

/**
 * LOCAL review only: an admin for the migration database so the migrated site can be checked in
 * the admin. Same authenticator secret as the dev admin; its own strong password, generated once
 * and kept only in the local .env (MIGRATION_ADMIN_PASSWORD, never printed).
 * Never called for the production target — production accounts are created by the owner.
 */
export async function ensureLocalReviewAdmin(run: Run): Promise<void> {
  // Own guard, not just the caller's: only ever the local migration database on this machine.
  const url = process.env.DATABASE_URL ?? ''
  const host = /^mongodb:\/\/(?:[^/]*@)?([^/:?]+)/.exec(url)?.[1] ?? ''
  const db = /^mongodb:\/\/[^/]+\/([^?]+)/.exec(url)?.[1] ?? ''
  if (!['127.0.0.1', 'localhost'].includes(host) || db !== LOCAL_MIGRATION_DB)
    throw new Error('review admin is only created in the local migration database')
  const email = REVIEW_ADMIN_EMAIL
  const totpSecret = process.env.DEV_ADMIN_TOTP_SECRET
  if (!totpSecret || run.dryRun) return
  const found = await run.payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs[0]) return
  let password = process.env.MIGRATION_ADMIN_PASSWORD
  if (!password) {
    password = randomBytes(18).toString('base64url')
    appendLocalEnv('MIGRATION_ADMIN_PASSWORD', password)
    run.log('review admin password written to .env (MIGRATION_ADMIN_PASSWORD)')
  }
  await run.payload.create({
    collection: 'users',
    data: { email, password, name: 'Migration Review', role: 'admin', totpSecret } as never,
    overrideAccess: true,
    context: run.context,
  })
}
