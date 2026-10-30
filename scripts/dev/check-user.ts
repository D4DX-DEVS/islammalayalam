/**
 * LOCAL DB ONLY (`npm run seed:dev` style guard): an admin account for manual or automated checks
 * with a sign-in you choose, so nobody has to read the dev admin's values out of .env:
 *
 *   CHECK_EMAIL=me@islammalayalam.test CHECK_PASSWORD=… CHECK_TOTP=<base32> \
 *     node scripts/dev/local.mjs payload run scripts/dev/check-user.ts
 *
 * Idempotent: an existing account with that email gets the new password and secret.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { assertLocalDevDatabase } from './guard'

assertLocalDevDatabase()
const email = process.env.CHECK_EMAIL
const password = process.env.CHECK_PASSWORD
const totpSecret = process.env.CHECK_TOTP
if (!email || !password || !totpSecret)
  throw new Error('CHECK_EMAIL, CHECK_PASSWORD and CHECK_TOTP (base32) are required')

const payload = await getPayload({ config })
const found = await payload.find({
  collection: 'users',
  where: { email: { equals: email } },
  limit: 1,
  overrideAccess: true,
})
const data = { email, password, name: 'Check Admin', role: 'admin' as const, totpSecret }
const context = { actor: 'dev-check-user' }
if (found.docs[0])
  await payload.update({
    collection: 'users',
    id: found.docs[0].id,
    data,
    overrideAccess: true,
    context,
  })
else await payload.create({ collection: 'users', data: data as never, overrideAccess: true, context })
payload.logger.info(`Check account ready: ${email}`)
process.exit(0)
