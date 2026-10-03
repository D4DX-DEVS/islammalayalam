import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import { totpAccess } from 'payload-totp'

/**
 * Deny-by-default access control.
 *
 * Staff access requires (a) a staff role and (b) completed TOTP enrollment, unless MFA is disabled
 * (NODE_ENV=test only, enforced in src/lib/env.ts). The payload-totp plugin already forces the
 * TOTP login step for enrolled users; (b) closes the gap where a password-only session of a
 * not-yet-enrolled user could use the REST API before finishing setup.
 */
export const ROLES = ['admin', 'editor', 'author'] as const
export type Role = (typeof ROLES)[number]

type MaybeUser = PayloadRequest['user'] & { role?: Role | null; hasTotp?: boolean }

const mfaDisabled = (): boolean =>
  process.env.TOTP_DISABLED === 'true' && process.env.NODE_ENV === 'test'

export function isEnrolled(user: MaybeUser | null | undefined): boolean {
  if (!user) return false
  return mfaDisabled() || user.hasTotp === true
}

export function hasRole(user: MaybeUser | null | undefined, ...roles: Role[]): boolean {
  return Boolean(user && isEnrolled(user) && user.role && roles.includes(user.role))
}

const userOf = (req: PayloadRequest) => req.user as MaybeUser | null

/** Collection/global access helpers (wrapped by payload-totp automatically unless noted). */
export const isAdmin: Access = ({ req }) => hasRole(userOf(req), 'admin')
export const isEditor: Access = ({ req }) => hasRole(userOf(req), 'admin', 'editor')
export const isStaff: Access = ({ req }) => hasRole(userOf(req), 'admin', 'editor', 'author')
export const nobody: Access = () => false

/**
 * Public read of published documents; editors/admins see every draft, authors only their own
 * ("Author: own drafts only"). Used with `custom.totp.disableAccessWrapper.read = true`, so TOTP is
 * re-applied manually for signed-in users. Draft queries apply this to the latest version.
 */
export const publishedOrStaff: Access = async (args) => {
  const user = userOf(args.req)
  if (!user) return { _status: { equals: 'published' } } satisfies Where
  const allowed = await totpAccess(isStaff)(args)
  if (allowed !== true || hasRole(user, 'admin', 'editor')) return allowed
  return {
    or: [{ _status: { equals: 'published' } }, { createdBy: { equals: user.id } }],
  } satisfies Where
}

/** Version history: editors/admins all, authors only versions of their own documents. */
export const versionsOfOwnOrEditor: Access = ({ req }) => {
  const user = userOf(req)
  if (hasRole(user, 'admin', 'editor')) return true
  if (hasRole(user, 'author') && user)
    return { 'version.createdBy': { equals: user.id } } satisfies Where
  return false
}

/** Public read of non-versioned content (categories, authors, media); staff after TOTP. */
export const publicOrStaff: Access = (args) => {
  if (!args.req.user) return true
  return totpAccess(isStaff)(args)
}

/** Authors may only touch documents they created; editors/admins everything. */
export const editorOrOwnDoc: Access = ({ req }) => {
  const user = userOf(req)
  if (hasRole(user, 'admin', 'editor')) return true
  if (hasRole(user, 'author') && user) return { createdBy: { equals: user.id } } satisfies Where
  return false
}

/** Users collection: admins manage everyone; others only themselves (TOTP-enrolled). */
export const adminOrSelf: Access = ({ req }) => {
  const user = userOf(req)
  if (hasRole(user, 'admin')) return true
  if (user && isEnrolled(user)) return { id: { equals: user.id } } satisfies Where
  return false
}

export const adminFieldOnly: FieldAccess = ({ req }) => hasRole(userOf(req), 'admin')
export const editorFieldOnly: FieldAccess = ({ req }) => hasRole(userOf(req), 'admin', 'editor')
export const staffFieldOnly: FieldAccess = ({ req }) =>
  hasRole(userOf(req), 'admin', 'editor', 'author')

/** Access config fragment that tells payload-totp not to wrap `read` (we handle it above). */
export const totpPublicRead = { totp: { disableAccessWrapper: { read: true } } } as const
