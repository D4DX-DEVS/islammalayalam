import { cdnUrl, spacesEndpoint, spacesFolder } from '@/lib/spaces'

/**
 * Where a migration run writes. Pure: turns the loaded env (+ CLI choice) into the process.env
 * overrides applied BEFORE the Payload config is imported. Never logs or returns secrets in messages.
 *
 * - `local`      → a local MongoDB database `islammalayalam_migration` and the `media-migration/`
 *                  folder. The live MONGODB_URI / DO_SPACES_* from .env are switched off. The default.
 * - `production` → MONGODB_URI + DO_SPACES_* from .env, exactly as the app reads them. Only with
 *                  an explicit confirmation flag.
 */
export type TargetName = 'local' | 'production'
export const LOCAL_MIGRATION_DB = 'islammalayalam_migration'
export const LOCAL_MEDIA_DIR = 'media-migration'
/** Positional token (`payload run` strips `--flags`). */
export const PRODUCTION_CONFIRM_FLAG = 'confirm=i-understand-this-writes-to-production'

const LOCAL_MONGO = 'mongodb://127.0.0.1:27017'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const SPACES_KEYS = [
  'DO_SPACES_BUCKET',
  'DO_SPACES_ENDPOINT',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
  'DO_SPACES_CDN_ENDPOINT',
  'DO_SPACES_FOLDER',
]

export type ResolvedTarget = {
  name: TargetName
  /** Safe to print: no credentials, no host names of remote services. */
  description: string
  overrides: Record<string, string>
}

export class TargetError extends Error {}

function parseMongo(url: string): { host: string; db: string; srv: boolean } {
  if (!/^mongodb(\+srv)?:\/\//.test(url)) throw new TargetError('not a MongoDB connection string')
  const srv = url.startsWith('mongodb+srv://')
  let u: URL
  try {
    u = new URL(url.replace(/^mongodb(\+srv)?:\/\//, 'http://').replace(/\/\/[^@/]*@/, '//'))
  } catch {
    throw new TargetError('MONGODB_URI must name a single host (mongodb+srv:// for a cluster)')
  }
  return {
    host: u.hostname.replace(/^\[|\]$/g, ''),
    db: decodeURIComponent(u.pathname.replace(/^\//, '')),
    srv,
  }
}

export function resolveTarget(
  name: TargetName,
  env: Readonly<Record<string, string | undefined>>,
  args: readonly string[] = [],
): ResolvedTarget {
  if (name === 'local') {
    const overrides: Record<string, string> = {
      MONGODB_URI: `${LOCAL_MONGO}/${LOCAL_MIGRATION_DB}`,
      MEDIA_DIR: LOCAL_MEDIA_DIR,
    }
    for (const k of SPACES_KEYS) overrides[k] = ''
    return {
      name,
      description: `local MongoDB database "${LOCAL_MIGRATION_DB}" + ./${LOCAL_MEDIA_DIR}/`,
      overrides,
    }
  }

  if (!args.includes(PRODUCTION_CONFIRM_FLAG))
    throw new TargetError(`production target needs ${PRODUCTION_CONFIRM_FLAG}`)
  const missing = ['MONGODB_URI', ...SPACES_KEYS.filter((k) => k !== 'DO_SPACES_FOLDER')].filter(
    (k) => !env[k],
  )
  if (missing.length) throw new TargetError(`production target: missing ${missing.join(', ')}`)
  const mongo = parseMongo(env.MONGODB_URI!)
  if (LOCAL_HOSTS.has(mongo.host))
    throw new TargetError('production target: MONGODB_URI points at localhost')
  if (!mongo.db)
    throw new TargetError(
      'production target: MONGODB_URI has no database name (add /<name> before the "?")',
    )
  let region: string
  try {
    region = spacesEndpoint(env.DO_SPACES_ENDPOINT!).region
  } catch (err) {
    throw new TargetError((err as Error).message)
  }
  if (!cdnUrl(env.DO_SPACES_CDN_ENDPOINT))
    throw new TargetError('DO_SPACES_CDN_ENDPOINT must use https')
  const folder = spacesFolder(env.DO_SPACES_FOLDER)
  return {
    name,
    description: `production MongoDB database "${mongo.db}" + DigitalOcean Spaces (${region}${folder ? `, folder "${folder}"` : ''})`,
    // The app reads MONGODB_URI / DO_SPACES_* itself; only the local media folder is switched off.
    overrides: { MEDIA_DIR: '' },
  }
}
