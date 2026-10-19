import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import { mfaSatisfied, type MfaUser } from '@/lib/mfa-policy'

/**
 * Deny-by-default access control.
 *
 * Staff access requires (a) a staff role and (b) a session that passed every sign-in step the site
 * requires: while Settings → Security asks for two-step verification, that is password AND an
 * authenticator code (payload-totp's "totp" session); otherwise the password alone. This is the
 * only TOTP check on data: payload-totp's static access wrapper is switched off so the setting can
 * change at runtime (src/payload/mfa.ts).
 */
export const ROLES = ['admin', 'editor', 'author'] as const
export type Role = (typeof ROLES)[number]

type MaybeUser = PayloadRequest['user'] & MfaUser & { role?: Role | null }

/** Signed in AND past the second step when the site requires it. */
export function isEnrolled(user: MaybeUser | null | undefined): boolean {
  return Boolean(user && mfaSatisfied(user))
}

export function hasRole(user: MaybeUser | null | undefined, ...roles: Role[]): boolean {
  return Boolean(user && isEnrolled(user) && user.role && roles.includes(user.role))
}

const userOf = (req: PayloadRequest) => req.user as MaybeUser | null

/** Collection/global access helpers. */
export const isAdmin: Access = ({ req }) => hasRole(userOf(req), 'admin')
export const isEditor: Access = ({ req }) => hasRole(userOf(req), 'admin', 'editor')
export const isStaff: Access = ({ req }) => hasRole(userOf(req), 'admin', 'editor', 'author')
export const nobody: Access = () => false

/**
 * Public read of published documents; editors/admins see every draft, authors only their own
 * ("Author: own drafts only"). A signed-in user who has not finished sign-in sees nothing.
 * Draft queries apply this to the latest version.
 */
export const publishedOrStaff: Access = (args) => {
  const user = userOf(args.req)
  if (!user) return { _status: { equals: 'published' } } satisfies Where
  const allowed = isStaff(args)
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

/** Public read of non-versioned content (categories, authors, media); staff after full sign-in. */
export const publicOrStaff: Access = (args) => {
  if (!args.req.user) return true
  return isStaff(args)
}

/** Authors may only touch documents they created; editors/admins everything. */
export const editorOrOwnDoc: Access = ({ req }) => {
  const user = userOf(req)
  if (hasRole(user, 'admin', 'editor')) return true
  if (hasRole(user, 'author') && user) return { createdBy: { equals: user.id } } satisfies Where
  return false
}

/** Users collection: admins manage everyone; others only themselves (after full sign-in). */
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

/**
 * Marks entities with public `read`. Inert while payload-totp's access wrapper is off (see above);
 * kept so the public reads stay public should the wrapper ever be switched back on.
 */
export const totpPublicRead = { totp: { disableAccessWrapper: { read: true } } } as const

/** Public read of items marked "Active" only (quotes, audio and video links); staff see everything after full sign-in. */
export const publicActiveOrStaff: Access = (args) =>
  args.req.user ? isStaff(args) : ({ active: { equals: true } } satisfies Where)
