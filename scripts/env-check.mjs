/**
 * `npm run env:check` — report WHICH settings are present in .env and what kind they are, loading the
 * files exactly like Next does. It never prints a value, a host name or any part of a secret: only
 * variable names and yes/no facts. Safe to paste into a chat or a ticket.
 */
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
const { loadedEnvFiles } = loadEnvConfig(process.cwd(), false, { info: () => {}, error: () => {} })

const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])
/** local | remote | invalid for a MongoDB connection string (host is never printed). */
function mongoKind(url) {
  if (!url) return 'missing'
  if (!/^mongodb(\+srv)?:\/\//.test(url)) return 'not a MongoDB URL'
  try {
    const host = new URL(
      url.replace(/^mongodb(\+srv)?:\/\//, 'http://').replace(/\/\/[^@/]*@/, '//'),
    ).hostname
    const kind = LOCAL.has(host.replace(/^\[|\]$/g, '')) ? 'local' : 'remote'
    return `${kind}${url.startsWith('mongodb+srv://') ? ' (srv)' : ''}`
  } catch {
    return 'unparseable'
  }
}
const isSet = (k) => (process.env[k] ? 'set' : 'missing')
const httpsKind = (k) => {
  const v = process.env[k]
  if (!v) return 'missing'
  try {
    return new URL(v).protocol === 'https:' ? 'set (https)' : 'set (not https)'
  } catch {
    return 'set (not a URL)'
  }
}

const KNOWN = {
  NODE_ENV: () => process.env.NODE_ENV ?? '(unset)',
  DATABASE_URL: () => mongoKind(process.env.DATABASE_URL),
  PAYLOAD_SECRET: () =>
    process.env.PAYLOAD_SECRET
      ? `set (${process.env.PAYLOAD_SECRET.length >= 32 ? '≥32 chars' : 'TOO SHORT'})`
      : 'missing',
  NEXT_PUBLIC_SERVER_URL: () => (process.env.NEXT_PUBLIC_SERVER_URL ? 'set' : 'missing'),
  ALLOW_REMOTE_DB: () => process.env.ALLOW_REMOTE_DB ?? '(unset = false)',
  ALLOW_REMOTE_MEDIA: () => process.env.ALLOW_REMOTE_MEDIA ?? '(unset = false)',
  S3_BUCKET: () => isSet('S3_BUCKET'),
  S3_REGION: () => isSet('S3_REGION'),
  S3_ENDPOINT: () => httpsKind('S3_ENDPOINT'),
  S3_ACCESS_KEY_ID: () => isSet('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: () => isSet('S3_SECRET_ACCESS_KEY'),
  MEDIA_CDN_URL: () => httpsKind('MEDIA_CDN_URL'),
}

/** Production migration target — read ONLY by the migration tool (`--target=production`). */
const PRODUCTION_TARGET = {
  MONGODB_URI: () => mongoKind(process.env.MONGODB_URI),
  DO_SPACES_BUCKET: () => isSet('DO_SPACES_BUCKET'),
  DO_SPACES_ENDPOINT: () => httpsKind('DO_SPACES_ENDPOINT'),
  DO_SPACES_CDN_ENDPOINT: () => httpsKind('DO_SPACES_CDN_ENDPOINT'),
  DO_SPACES_FOLDER: () => isSet('DO_SPACES_FOLDER'),
  DO_SPACES_KEY: () => isSet('DO_SPACES_KEY'),
  DO_SPACES_SECRET: () => isSet('DO_SPACES_SECRET'),
}

console.log(`Env files loaded: ${loadedEnvFiles.map((f) => f.path).join(', ') || '(none)'}`)
console.log('App (dev server, tests):')
for (const [name, describe] of Object.entries(KNOWN))
  console.log(`  ${name.padEnd(22)} ${describe()}`)
console.log('Production migration target (migration tool only):')
for (const [name, describe] of Object.entries(PRODUCTION_TARGET))
  console.log(`  ${name.padEnd(22)} ${describe()}`)

// Other names defined in the env files (names only), e.g. differently named keys.
const known = new Set([...Object.keys(KNOWN), ...Object.keys(PRODUCTION_TARGET)])
const others = [...new Set(loadedEnvFiles.flatMap((f) => Object.keys(f.env)))]
  .filter((n) => !known.has(n))
  .sort()
console.log(`Other variables defined (names only): ${others.join(', ') || '(none)'}`)
for (const n of others)
  if (/mongo|database|db_?url/i.test(n))
    console.log(`  ${n.padEnd(22)} ${mongoKind(process.env[n])}`)
