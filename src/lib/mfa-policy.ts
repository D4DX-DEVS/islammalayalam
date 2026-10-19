/**
 * Two-step sign-in policy shared by access control (server) and the admin redirect provider
 * (server + client). Pure: no Payload or Next imports, so it is safe in the browser bundle.
 *
 * Whether the site requires the second step comes from Settings → Security and reaches the user
 * object as the virtual `mfaRequired` field (src/payload/mfa.ts). Anything other than an explicit
 * `false` counts as required, so a missing or unreadable setting fails closed.
 */
export type MfaUser = {
  hasTotp?: boolean | null
  mfaRequired?: boolean | null
  _strategy?: string | null
}

export type MfaStep = 'verify' | 'setup'

export type MfaRoutes = {
  verify: string
  setup: string
  /** Pages an unverified user may still open (sign-out). */
  open: string[]
}

/** Slug of the Settings → Security global that holds the setting (src/payload/mfa.ts). */
export const SECURITY_SETTINGS = 'security-settings'

/** MFA can only be switched off by environment in NODE_ENV=test (enforced in src/lib/env.ts). */
export const mfaEnvDisabled = (): boolean =>
  process.env.TOTP_DISABLED === 'true' && process.env.NODE_ENV === 'test'

/**
 * The sign-in step this session would still owe if the second step were required right now:
 * a code for someone with an authenticator app, the QR setup for someone without, or null for a
 * session that already entered a valid code (payload-totp's strategy only authenticates those).
 */
export function mfaStepOwed(user: MfaUser): MfaStep | null {
  if (user.hasTotp === true && user._strategy === 'totp') return null
  return user.hasTotp === true ? 'verify' : 'setup'
}

/** True when this signed-in user has passed every sign-in step the site currently requires. */
export function mfaSatisfied(user: MfaUser): boolean {
  if (mfaEnvDisabled() || user.mfaRequired === false) return true
  return mfaStepOwed(user) === null
}

const normalize = (path: string): string => path.replace(/\/+$/, '') || '/'

/**
 * The sign-in step this user still has to complete before using the admin, or null.
 * Enrolled users enter a code; users without an authenticator app are sent to set one up (QR).
 */
export function pendingMfaStep(
  user: MfaUser | null | undefined,
  pathname: string,
  routes: MfaRoutes,
): MfaStep | null {
  if (!user || mfaSatisfied(user)) return null
  const path = normalize(pathname)
  const step = mfaStepOwed(user) ?? 'verify'
  const allowed = [routes[step], ...routes.open].map(normalize)
  return allowed.includes(path) ? null : step
}
