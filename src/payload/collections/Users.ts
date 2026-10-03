import { APIError } from 'payload'
import type { CollectionBeforeOperationHook, CollectionConfig } from 'payload'
import { adminFieldOnly, adminOrSelf, isAdmin, ROLES } from '@/payload/access'
import { auditCollectionChange, auditCollectionDelete, auditLogin } from '@/payload/hooks/auditLog'

const MIN_PASSWORD = 12
const MAX_PASSWORD = 256
const isProd = process.env.NODE_ENV === 'production'

/** Runs for create, update and resetPassword (the reset flow skips field validation). */
const enforcePasswordPolicy: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update' && operation !== 'resetPassword') return args
  const pwd = (args as { data?: { password?: unknown } }).data?.password
  if (pwd === undefined || pwd === null || pwd === '') return args
  if (typeof pwd !== 'string' || pwd.length < MIN_PASSWORD || pwd.length > MAX_PASSWORD) {
    throw new APIError(
      `Password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters`,
      400,
      undefined,
      true,
    )
  }
  return args
}

/**
 * On an empty database Payload serves an open "create first user" form (/admin/create-first-user,
 * POST /api/users/first-register). Whoever reaches it first would own the site, so the first
 * account may only be created through the Local API (CLI / seed script on the server).
 */
export const blockRemoteFirstUser: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' || req.payloadAPI === 'local') return args
  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
  if (totalDocs === 0)
    throw new APIError(
      'The first admin account must be created from the server CLI',
      403,
      undefined,
      true,
    )
  return args
}

/**
 * Staff accounts (ASVS V2/V3): lockout after 5 failures for 15 min, 4 h sessions, secure/Lax
 * cookies, no API keys, 12+ char passwords, TOTP enforced by payload-totp (forceSetup).
 * Public sign-up does not exist: only admins create users.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'updatedAt'],
    group: 'Admin',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 4 * 60 * 60,
    useAPIKey: false,
    useSessions: true,
    removeTokenFromResponses: true,
    cookies: { secure: isProd, sameSite: 'Lax' },
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: isAdmin,
    read: adminOrSelf,
    update: adminOrSelf,
    delete: isAdmin,
    unlock: isAdmin,
  },
  hooks: {
    beforeOperation: [blockRemoteFirstUser, enforcePasswordPolicy],
    beforeChange: [
      // The very first account (created via CLI/first-register on an empty DB) must be an admin.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const { totalDocs } = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
          req,
        })
        return totalDocs === 0 ? { ...data, role: 'admin' } : data
      },
    ],
    afterLogin: [auditLogin],
    afterChange: [auditCollectionChange],
    afterDelete: [auditCollectionDelete],
  },
  fields: [
    { name: 'name', type: 'text', maxLength: 120 },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'author',
      options: ROLES.map((r) => ({ label: r[0]!.toUpperCase() + r.slice(1), value: r })),
      saveToJWT: true,
      access: { create: adminFieldOnly, update: adminFieldOnly },
      admin: {
        position: 'sidebar',
        description:
          'Admin: everything. Editor: all content + publishing. Author: own drafts only.',
      },
    },
  ],
}
