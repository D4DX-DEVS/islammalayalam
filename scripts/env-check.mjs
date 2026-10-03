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
/** Host name or https URL (DO_SPACES_ENDPOINT / DO_SPACES_CDN_ENDPOINT accept both). */
const hostKind = (k) => {
  const v = process.env[k]
  if (!v) return 'missing'
  if (/^https:\/\//i.test(v)) return 'set (https)'
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? 'set (not https)' : 'set (host name)'
}

/** Read by the app locally and in production (src/lib/env.ts) and by the migration tool. */
const KNOWN = {
  NODE_ENV: () => process.env.NODE_ENV ?? '(unset)',
  MONGODB_URI: () => mongoKind(process.env.MONGODB_URI),
  PAYLOAD_SECRET: () =>
    process.env.PAYLOAD_SECRET
      ? `set (${process.env.PAYLOAD_SECRET.length >= 32 ? '≥32 chars' : 'TOO SHORT'})`
      : 'missing',
  NEXT_PUBLIC_SERVER_URL: () => (process.env.NEXT_PUBLIC_SERVER_URL ? 'set' : 'missing'),
  DO_SPACES_BUCKET: () => isSet('DO_SPACES_BUCKET'),
  DO_SPACES_ENDPOINT: () => hostKind('DO_SPACES_ENDPOINT'),
  DO_SPACES_CDN_ENDPOINT: () => hostKind('DO_SPACES_CDN_ENDPOINT'),
  DO_SPACES_FOLDER: () => isSet('DO_SPACES_FOLDER'),
  DO_SPACES_KEY: () => isSet('DO_SPACES_KEY'),
  DO_SPACES_SECRET: () => isSet('DO_SPACES_SECRET'),
}

console.log(`Env files loaded: ${loadedEnvFiles.map((f) => f.path).join(', ') || '(none)'}`)
console.log('App (local dev and production):')
for (const [name, describe] of Object.entries(KNOWN))
  console.log(`  ${name.padEnd(22)} ${describe()}`)

// Other names defined in the env files (names only), e.g. differently named keys.
const known = new Set(Object.keys(KNOWN))
const others = [...new Set(loadedEnvFiles.flatMap((f) => Object.keys(f.env)))]
  .filter((n) => !known.has(n))
  .sort()
console.log(`Other variables defined (names only): ${others.join(', ') || '(none)'}`)
for (const n of others)
  if (/mongo|database|db_?url/i.test(n))
    console.log(`  ${n.padEnd(22)} ${mongoKind(process.env[n])}`)
