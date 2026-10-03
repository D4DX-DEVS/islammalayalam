import { appendFileSync } from 'node:fs'
import { getEnv } from '@/lib/env'

/**
 * Dev-script safety rail: refuse to run anywhere except a local, `_dev`/`_test` MongoDB.
 * Every script under scripts/dev must call this first.
 */
export function assertLocalDevDatabase(): void {
  const env = getEnv()
  if (env.NODE_ENV === 'production')
    throw new Error('Refusing to run a dev script with NODE_ENV=production')
  const url = new URL(env.DATABASE_URL.replace(/^mongodb(\+srv)?:\/\//, 'http://'))
  const host = url.hostname
  const db = url.pathname.replace(/^\//, '')
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host))
    throw new Error(`Refusing to seed non-local MongoDB host "${host}"`)
  if (!/_(dev|test)$/.test(db))
    throw new Error(`Refusing to seed database "${db}" (must end with _dev or _test)`)
}

/** Append a variable to the local .env without ever printing its value. */
export function appendLocalEnv(name: string, value: string): void {
  appendFileSync('.env', `\n${name}=${value}\n`, { mode: 0o600 })
}
