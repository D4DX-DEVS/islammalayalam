/**
 * Where a migration run writes. Pure: turns the loaded env (+ CLI choice) into the process.env
 * overrides applied BEFORE the Payload config is imported. Never logs or returns secrets in messages.
 *
 * - `local`      → the local MongoDB (same host as DATABASE_URL, database `islammalayalam_migration`)
 *                  and the `media-migration/` folder. Spaces is switched off. The default.
 * - `production` → MONGODB_URI + DO_SPACES_* (names chosen by the owner in .env). Only with an
 *                  explicit confirmation flag; the app's own DATABASE_URL / S3_* are never touched.
 */
export type TargetName = 'local' | 'production'
export const LOCAL_MIGRATION_DB = 'islammalayalam_migration'
export const LOCAL_MEDIA_DIR = 'media-migration'
/** Positional token (`payload run` strips `--flags`). */
export const PRODUCTION_CONFIRM_FLAG = 'confirm=i-understand-this-writes-to-production'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const S3_KEYS = [
  'S3_BUCKET',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
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
  const u = new URL(url.replace(/^mongodb(\+srv)?:\/\//, 'http://').replace(/\/\/[^@/]*@/, '//'))
  return {
    host: u.hostname.replace(/^\[|\]$/g, ''),
    db: decodeURIComponent(u.pathname.replace(/^\//, '')),
    srv,
  }
}

/** Replace the database name in a MongoDB URL (keeps credentials/options untouched). */
export function withDatabase(url: string, db: string): string {
  const m = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/.exec(url)
  if (!m) throw new TargetError('cannot parse the MongoDB connection string')
  return `${m[1]}/${db}${m[2] ?? ''}`
}

/** `blr1.digitaloceanspaces.com` or `https://blr1.digitaloceanspaces.com/` → endpoint + region. */
export function spacesEndpoint(raw: string): { endpoint: string; region: string } {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    throw new TargetError('DO_SPACES_ENDPOINT is not a host name or URL')
  }
  if (u.protocol !== 'https:') throw new TargetError('DO_SPACES_ENDPOINT must use https')
  const labels = u.hostname.split('.')
  // Accept the regional endpoint (blr1.digitaloceanspaces.com) or a bucket host (<bucket>.blr1.…).
  const i = labels.length - 2
  // Exactly "….digitaloceanspaces.com" (credentials are sent here; a look-alike host is refused).
  if (i < 1 || labels[i] !== 'digitaloceanspaces' || labels[i + 1] !== 'com' || u.port)
    throw new TargetError('DO_SPACES_ENDPOINT is not a DigitalOcean Spaces endpoint')
  const region = labels[i - 1]!
  return { endpoint: `https://${labels.slice(i - 1).join('.')}`, region }
}

export function resolveTarget(
  name: TargetName,
  env: Readonly<Record<string, string | undefined>>,
  args: readonly string[] = [],
): ResolvedTarget {
  if (name === 'local') {
    if (!env.DATABASE_URL) throw new TargetError('DATABASE_URL is missing')
    const { host } = parseMongo(env.DATABASE_URL)
    if (!LOCAL_HOSTS.has(host))
      throw new TargetError('local target: DATABASE_URL must point at a local MongoDB')
    const overrides: Record<string, string> = {
      DATABASE_URL: withDatabase(env.DATABASE_URL, LOCAL_MIGRATION_DB),
      MEDIA_DIR: LOCAL_MEDIA_DIR,
      ALLOW_REMOTE_DB: 'false',
      ALLOW_REMOTE_MEDIA: 'false',
      MEDIA_CDN_URL: '',
      S3_PREFIX: '',
    }
    for (const k of S3_KEYS) overrides[k] = ''
    return {
      name,
      description: `local MongoDB database "${LOCAL_MIGRATION_DB}" + ./${LOCAL_MEDIA_DIR}/`,
      overrides,
    }
  }

  if (!args.includes(PRODUCTION_CONFIRM_FLAG))
    throw new TargetError(`production target needs ${PRODUCTION_CONFIRM_FLAG}`)
  const missing = [
    'MONGODB_URI',
    'DO_SPACES_BUCKET',
    'DO_SPACES_ENDPOINT',
    'DO_SPACES_KEY',
    'DO_SPACES_SECRET',
    'DO_SPACES_CDN_ENDPOINT',
  ].filter((k) => !env[k])
  if (missing.length) throw new TargetError(`production target: missing ${missing.join(', ')}`)
  const mongo = parseMongo(env.MONGODB_URI!)
  if (LOCAL_HOSTS.has(mongo.host))
    throw new TargetError('production target: MONGODB_URI points at localhost')
  if (!mongo.db)
    throw new TargetError(
      'production target: MONGODB_URI has no database name (add /<name> before the "?")',
    )
  const { endpoint, region } = spacesEndpoint(env.DO_SPACES_ENDPOINT!)
  const cdn = new URL(
    /^https?:\/\//i.test(env.DO_SPACES_CDN_ENDPOINT!)
      ? env.DO_SPACES_CDN_ENDPOINT!
      : `https://${env.DO_SPACES_CDN_ENDPOINT}`,
  )
  if (cdn.protocol !== 'https:') throw new TargetError('DO_SPACES_CDN_ENDPOINT must use https')
  const folder = (env.DO_SPACES_FOLDER ?? '').replace(/^\/+|\/+$/g, '')
  return {
    name,
    description: `production MongoDB database "${mongo.db}" + DigitalOcean Spaces (${region}${folder ? `, folder "${folder}"` : ''})`,
    overrides: {
      DATABASE_URL: env.MONGODB_URI!,
      ALLOW_REMOTE_DB: 'true',
      ALLOW_REMOTE_MEDIA: 'true',
      S3_BUCKET: env.DO_SPACES_BUCKET!,
      S3_REGION: region,
      S3_ENDPOINT: endpoint,
      S3_ACCESS_KEY_ID: env.DO_SPACES_KEY!,
      S3_SECRET_ACCESS_KEY: env.DO_SPACES_SECRET!,
      S3_PREFIX: folder,
      MEDIA_CDN_URL: cdn.origin + cdn.pathname.replace(/\/$/, ''),
      MEDIA_DIR: '',
    },
  }
}
