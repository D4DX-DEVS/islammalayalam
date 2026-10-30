#!/usr/bin/env node
/**
 * Runs a command against the LOCAL development database and local media, whatever .env says:
 *
 *   node scripts/dev/local.mjs next dev -p 3444
 *   node scripts/dev/local.mjs payload run scripts/dev/seed.ts
 *
 * `npm run dev`, `seed:dev` and the Playwright server all go through here, so everyday work can
 * never write to the live MongoDB or DigitalOcean Spaces by accident. Working on the live data is
 * a separate, explicit choice: `npm run dev:live` (src/lib/env.ts explains the rail).
 *
 * Variables already set in the shell win over .env when Next/Payload load it, so these overrides
 * stick. DB name: override with LOCAL_DB_NAME (must end in _dev or _test; scripts/dev/guard.ts).
 */
import { spawn } from 'node:child_process'
import { delimiter, join } from 'node:path'

/** Outside an npm script the project's own binaries (next, payload) are not on PATH: add them. */
function withLocalBin(env) {
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  return { ...env, [key]: [join(process.cwd(), 'node_modules', '.bin'), env[key]].filter(Boolean).join(delimiter) }
}

const db = process.env.LOCAL_DB_NAME || 'islammalayalam_dev'
if (!/^[a-z0-9_]+_(dev|test)$/.test(db)) {
  process.stderr.write(`LOCAL_DB_NAME must be a plain name ending in _dev or _test (got "${db}")\n`)
  process.exit(2)
}

export const LOCAL_ENV = {
  MONGODB_URI: `mongodb://127.0.0.1:27017/${db}`,
  DO_SPACES_BUCKET: '',
  DO_SPACES_ENDPOINT: '',
  DO_SPACES_KEY: '',
  DO_SPACES_SECRET: '',
  DO_SPACES_CDN_ENDPOINT: '',
  DO_SPACES_FOLDER: '',
  ALLOW_LIVE_DATA: '',
}

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  process.stderr.write('Usage: node scripts/dev/local.mjs <command> [args...]\n')
  process.exit(2)
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: withLocalBin({
    ...process.env,
    ...LOCAL_ENV,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' '),
  }),
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
