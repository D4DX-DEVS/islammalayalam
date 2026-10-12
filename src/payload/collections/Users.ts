import { APIError } from 'payload'
import type { CollectionBeforeOperationHook, CollectionConfig, PayloadRequest } from 'payload'
import { adminFieldOnly, adminOrSelf, isAdmin, ROLES } from '@/payload/access'
import { auditCollectionChange, auditCollectionDelete, auditLogin } from '@/payload/hooks/auditLog'

const MIN_PASSWORD = 12
const MAX_PASSWORD = 256
const isProd = process.env.NODE_ENV === 'production'

/** `count` is not allowed inside a MongoDB transaction (the create runs in one), `find` is. */
async function hasAnyUser(req: PayloadRequest): Promise<boolean> {
  const { docs } = await req.payload.find({
    collection: 'users',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return docs.length > 0
}

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
  if (!(await hasAnyUser(req)))
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
        return (await hasAnyUser(req)) ? data : { ...data, role: 'admin' }
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
