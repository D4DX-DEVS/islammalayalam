/**
 * DigitalOcean Spaces settings, read from the owner's .env names (DO_SPACES_*). Pure and
 * dependency-free: used by the server env, next.config.ts, src/proxy.ts and the migration tool.
 * Error messages name the setting, never its value.
 */

/** `blr1.digitaloceanspaces.com` or `https://blr1.digitaloceanspaces.com/` → endpoint + region. */
export function spacesEndpoint(raw: string): { endpoint: string; region: string } {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    throw new Error('DO_SPACES_ENDPOINT is not a host name or URL')
  }
  if (u.protocol !== 'https:') throw new Error('DO_SPACES_ENDPOINT must use https')
  const labels = u.hostname.split('.')
  // Accept the regional endpoint (blr1.digitaloceanspaces.com) or a bucket host (<bucket>.blr1.…).
  const i = labels.length - 2
  // Exactly "….digitaloceanspaces.com" (credentials are sent here; a look-alike host is refused).
  if (i < 1 || labels[i] !== 'digitaloceanspaces' || labels[i + 1] !== 'com' || u.port)
    throw new Error('DO_SPACES_ENDPOINT is not a DigitalOcean Spaces endpoint')
  const region = labels[i - 1]!
  return { endpoint: `https://${labels.slice(i - 1).join('.')}`, region }
}

/** CDN host or https URL → `https://…` without a trailing slash; undefined when unset or not https. */
export function cdnUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return u.protocol === 'https:' ? u.origin + u.pathname.replace(/\/+$/, '') : undefined
  } catch {
    return undefined
  }
}

/** Folder inside the bucket without surrounding slashes: `/ISLAMMALAYALAM/` → `ISLAMMALAYALAM`. */
export const spacesFolder = (raw: string | undefined): string =>
  (raw ?? '').replace(/^\/+|\/+$/g, '')
