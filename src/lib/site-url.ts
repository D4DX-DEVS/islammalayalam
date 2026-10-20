/**
 * The site's public origin: what share links, canonical addresses and the sitemap are built from.
 * It comes from NEXT_PUBLIC_SERVER_URL, which Next bakes into the build — so on the host it must be
 * set for the *build* too. If it is missing from a production build the real domain is used, so a
 * "localhost" address can never reach a visitor (or Google).
 */
export const PRODUCTION_URL = 'https://islammalayalam.net'
export const DEVELOPMENT_URL = 'http://localhost:3444'

export const siteUrlFrom = (configured: string | undefined, nodeEnv: string | undefined): string =>
  configured?.trim() || (nodeEnv === 'production' ? PRODUCTION_URL : DEVELOPMENT_URL)

export const SITE_URL = siteUrlFrom(process.env.NEXT_PUBLIC_SERVER_URL, process.env.NODE_ENV)
