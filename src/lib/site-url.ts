/**
 * The site's public origin: what share links, canonical addresses and the sitemap are built from.
 * It comes from NEXT_PUBLIC_SERVER_URL, which Next bakes into the build — so on the host it must be
 * set for the *build* too. If it is missing from a production build — or points at this machine
 * (a local .env leaking into the build) — the real domain is used, so a "localhost" address can
 * never reach a visitor (or Google).
 */
export const PRODUCTION_URL = 'https://islammalayalam.net'
export const DEVELOPMENT_URL = 'http://localhost:3444'

const isLocalAddress = (url: string): boolean => {
  try {
    return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/i.test(new URL(url).hostname)
  } catch {
    return true // not even an address
  }
}

export const siteUrlFrom = (configured: string | undefined, nodeEnv: string | undefined): string => {
  const url = configured?.trim().replace(/\/+$/, '')
  if (nodeEnv === 'production') return url && !isLocalAddress(url) ? url : PRODUCTION_URL
  return url || DEVELOPMENT_URL
}

export const SITE_URL = siteUrlFrom(process.env.NEXT_PUBLIC_SERVER_URL, process.env.NODE_ENV)
