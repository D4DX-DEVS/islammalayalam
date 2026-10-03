/**
 * `npm run preview:production` — the dev server (port 3444) showing the REAL migrated content: the
 * production MongoDB (MONGODB_URI) and the files on the Spaces CDN, with the same settings the
 * migration used. Run it instead of `npm run dev`; stop it and run `npm run dev` for the seed data.
 *
 * For looking only. Viewing pages writes nothing; the credentials stay in this server process
 * (never sent to the browser); nobody can sign in while production has no staff account (the
 * first one is created on the server). Once staff accounts exist, anything saved in this admin is
 * saved in production.
 */
import nextEnv from '@next/env'
import { PRODUCTION_CONFIRM_FLAG, resolveTarget } from '../../migration/lib/target'
import { startNextDev } from './next-dev'

nextEnv.loadEnvConfig(process.cwd(), true)
startNextDev(resolveTarget('production', process.env, [PRODUCTION_CONFIRM_FLAG]))
