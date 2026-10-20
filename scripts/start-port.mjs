/**
 * The TCP port `npm start` listens on: the host's PORT when it is set, else 3444 (the port in
 * NEXT_PUBLIC_SERVER_URL for a local production preview). Pure, so it is unit-tested
 * (tests/unit/start-port.test.ts); scripts/start.mjs is the only runtime caller.
 */
export const DEFAULT_PORT = '3444'

/**
 * @param {{ PORT?: string | undefined }} env process.env or a stand-in
 * @returns {string} the port as text, as `next start -p` expects it
 */
export function resolvePort(env) {
  const raw = (env.PORT ?? '').trim()
  if (raw === '') return DEFAULT_PORT
  const port = Number(raw)
  if (!/^\d{1,5}$/.test(raw) || port < 1 || port > 65535)
    throw new Error(`PORT must be a TCP port number (1-65535), not "${raw}"`)
  return String(port)
}
