/**
 * `npm start` — the production server, started the same way on every host.
 *
 * DigitalOcean App Platform sets PORT and runs npm scripts with sh; a Windows PC sets no PORT and
 * runs them with cmd.exe, where a shell default like `${PORT:-3444}` is passed through literally
 * and `next start` refuses it as an invalid port. Resolving the port in Node keeps one script for
 * both: the host's PORT when set, otherwise 3444 so a local preview matches
 * NEXT_PUBLIC_SERVER_URL=http://localhost:3444 (the admin's CSRF/CORS origin).
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolvePort } from './start-port.mjs'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
const port = resolvePort(process.env)

// NODE_OPTIONS (not a flag) so Next's own worker processes inherit it, as with cross-env before.
const nodeOptions = [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' ')
const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
})

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  process.stderr.write(`Could not start the server: ${error.message}\n`)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
