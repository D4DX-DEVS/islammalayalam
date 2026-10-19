/** Variables whose values must never reach a log line, report or console. */
const SECRET_VARS = [
  'MONGODB_URI',
  'PAYLOAD_SECRET',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
  'MIGRATION_ADMIN_PASSWORD',
  'DEV_ADMIN_PASSWORD',
  'DEV_ADMIN_TOTP_SECRET',
]

/** Database hosts (e.g. the managed-MongoDB cluster name) are not secret, but stay out of reports. */
const HOST_VARS = ['MONGODB_URI']

function mongoHosts(url: string | undefined): string[] {
  const hosts = /^mongodb(?:\+srv)?:\/\/(?:[^/]*@)?([^/?]+)/.exec(url ?? '')?.[1]
  return (hosts ?? '')
    .split(',')
    .map((h) => h.replace(/:\d+$/, ''))
    .filter((h) => h.length >= 6 && !/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(h))
}

/** Text with every secret value, remote database host and connection-string credential removed. */
export function redact(
  text: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  let out = text
  for (const name of SECRET_VARS) {
    const value = env[name]
    if (value && value.length >= 6) out = out.split(value).join(`[${name}]`)
  }
  for (const name of HOST_VARS)
    for (const host of mongoHosts(env[name])) out = out.split(host).join('[database host]')
  // Credentials up to the LAST "@" before the host (a password may itself contain "@").
  return out.replace(/(mongodb(?:\+srv)?:\/\/)[^/\s]*@/gi, '$1[redacted]@')
}
