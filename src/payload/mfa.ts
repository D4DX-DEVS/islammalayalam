import type { Field, GlobalAfterChangeHook, Payload } from 'payload'
import { mfaEnvDisabled, SECURITY_SETTINGS } from '@/lib/mfa-policy'

/**
 * Settings → Security: whether staff sign-in needs the authenticator-app step. Admins switch it on
 * and off at runtime; payload-totp's own options are static, so the plugin is configured with its
 * access wrapper off and this setting drives access control (src/payload/access) and the admin
 * redirects (src/payload/admin/mfa) instead.
 *
 * Read on every user load (the virtual `mfaRequired` field), so it is cached briefly. A change saved
 * here applies at once on this server and within CACHE_MS on any other instance.
 */
export { SECURITY_SETTINGS }
export const CACHE_MS = 15_000

let cached: { value: boolean; at: number } | null = null
let pending: Promise<boolean> | null = null
// Bumped by every save, so a read that started before the save cannot overwrite the new value.
let generation = 0

function remember(value: boolean): boolean {
  cached = { value, at: Date.now() }
  return value
}

const required = (doc: unknown): boolean =>
  (doc as { requireTwoFactor?: boolean | null } | null)?.requireTwoFactor !== false

/** Forget the cached value (tests). */
export function resetMfaSettingCache(): void {
  cached = null
  pending = null
  generation++
}

/** Whether the second sign-in step is required right now. Unreadable setting → required. */
export async function isMfaRequired(payload: Payload): Promise<boolean> {
  if (mfaEnvDisabled()) return false
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  if (pending) return pending
  const gen = generation
  const read = payload
    .findGlobal({ slug: SECURITY_SETTINGS, depth: 0, overrideAccess: true })
    .then(required)
    .catch((err: unknown) => {
      payload.logger.error({ msg: 'security settings unreadable; two-step stays required', err })
      return true
    })
    .then((value) => (gen === generation ? remember(value) : (cached?.value ?? value)))
    .finally(() => {
      if (pending === read) pending = null
    })
  pending = read
  return read
}

/** Saving the setting takes effect on this server immediately. */
export const applyMfaSetting: GlobalAfterChangeHook = ({ doc }) => {
  generation++
  pending = null
  remember(required(doc))
  return doc
}

/** Users: the current setting, carried on every loaded user (req.user, /api/users/me). Never stored. */
export const mfaRequiredField: Field = {
  name: 'mfaRequired',
  type: 'checkbox',
  virtual: true,
  access: { create: () => false, update: () => false },
  admin: {
    hidden: true,
    disableBulkEdit: true,
    disableListColumn: true,
    disableListFilter: true,
  },
  hooks: { afterRead: [({ req }) => isMfaRequired(req.payload)] },
}
