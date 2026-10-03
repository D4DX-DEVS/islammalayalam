/**
 * `npm run dev:migration` — the normal dev server (port 3444), but reading the LOCAL migration
 * database and ./media-migration/ instead of the dev seed, to review a local migration run.
 * Nothing here is ever pointed at production: the target is resolved exactly as
 * `npm run migrate -- target=local` does.
 */
import nextEnv from '@next/env'
import { resolveTarget } from '../../migration/lib/target'
import { startNextDev } from './next-dev'

nextEnv.loadEnvConfig(process.cwd(), true)
startNextDev(resolveTarget('local', process.env))
