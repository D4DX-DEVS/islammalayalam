import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedTarget } from '../../migration/lib/target'

/**
 * Start the normal dev server (port 3444) with a migration target's settings in place of `.env`.
 * Two dev servers cannot share this folder, so it runs instead of `npm run dev`.
 */
export function startNextDev(target: ResolvedTarget): void {
  process.stdout.write(`dev server → ${target.description}\n`)
  // Data written by a migration run skips the cache purge, so start with an empty data cache.
  rmSync(join('.next', 'dev', 'cache', 'fetch-cache'), { recursive: true, force: true })
  const child = spawn(
    process.execPath,
    [join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', '3444'],
    {
      stdio: 'inherit',
      // Existing variables win over .env when Next loads it, so these overrides stick.
      env: { ...process.env, ...target.overrides, NODE_OPTIONS: '--no-deprecation' },
    },
  )
  child.on('exit', (code) => process.exit(code ?? 0))
}
