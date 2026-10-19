import { appendFileSync } from 'node:fs'
import { getEnv, spacesConfig } from '@/lib/env'

/**
 * Dev-script safety rail: refuse to run anywhere except a local, `_dev`/`_test` MongoDB with local
 * media — never the live MONGODB_URI / DO_SPACES_* from .env (package.json pins local values).
 * Every script under scripts/dev must call this first.
 */
export function assertLocalDevDatabase(): void {
  const env = getEnv()
  if (env.NODE_ENV === 'production')
    throw new Error('Refusing to run a dev script with NODE_ENV=production')
  if (spacesConfig(env))
    throw new Error('Refusing to run a dev script with DigitalOcean Spaces (DO_SPACES_*) set')
  let url: URL
  try {
    // Credentials dropped first: a URL error message would echo its input.
    url = new URL(
      env.MONGODB_URI.replace(/^mongodb(\+srv)?:\/\//, 'http://').replace(/\/\/[^@/]*@/, '//'),
    )
  } catch {
    throw new Error('Refusing to seed: MONGODB_URI is not a single local host')
  }
  const host = url.hostname
  const db = url.pathname.replace(/^\//, '')
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host))
    throw new Error('Refusing to seed a non-local MongoDB host')
  if (!/_(dev|test)$/.test(db))
    throw new Error(`Refusing to seed database "${db}" (must end with _dev or _test)`)
}

/** Append a variable to the local .env without ever printing its value. */
export function appendLocalEnv(name: string, value: string): void {
  appendFileSync('.env', `\n${name}=${value}\n`, { mode: 0o600 })
}
