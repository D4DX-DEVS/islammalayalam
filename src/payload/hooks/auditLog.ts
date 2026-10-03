import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterLoginHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

/**
 * Append-only audit trail (ASVS V7). Written with overrideAccess into `audit-logs`, which nobody
 * can update or delete through the API. Failures are logged but never block the editor's write.
 */
export const AUDIT_COLLECTION = 'audit-logs'
const IGNORED_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'searchText',
  'searchKey',
  '_status',
  'loginAttempts',
  'lockUntil',
  'sessions',
])

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'publish',
  'unpublish',
  'mfa-lockout',
] as const
type AuditAction = (typeof AUDIT_ACTIONS)[number]

function changedKeys(
  doc: Record<string, unknown>,
  prev: Record<string, unknown> | undefined,
): string[] {
  if (!prev) return []
  const keys = new Set([...Object.keys(doc), ...Object.keys(prev)])
  return [...keys]
    .filter((k) => !IGNORED_KEYS.has(k) && JSON.stringify(doc[k]) !== JSON.stringify(prev[k]))
    .slice(0, 40)
}

function clientIp(req: PayloadRequest): string | undefined {
  // Informational only: the first hop is attacker-controlled unless the edge proxy overwrites it.
  const fwd = req.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (fwd || req.headers?.get('x-real-ip') || undefined)?.slice(0, 64)
}

type Entry = {
  action: AuditAction
  target: string
  docId?: string
  changed?: string[]
  userId?: string
}

async function write(req: PayloadRequest, entry: Entry): Promise<void> {
  try {
    await req.payload.create({
      collection: AUDIT_COLLECTION,
      overrideAccess: true,
      req,
      // No `context` here: Payload merges it into the shared req, so flags would leak to later writes.
      data: {
        action: entry.action,
        target: entry.target,
        docId: entry.docId,
        changed: entry.changed?.join(', ') || undefined,
        user: entry.userId ?? (req.user?.id as string | undefined),
        actor:
          (entry.userId ?? req.user)
            ? undefined
            : ((req.context.actor as string | undefined) ?? 'system'),
        ip: clientIp(req),
      },
    })
  } catch (err) {
    req.payload.logger.error({
      msg: 'audit log write failed',
      target: entry.target,
      err: (err as Error).message,
    })
  }
}

export const auditCollectionChange: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (collection.slug === AUDIT_COLLECTION) return doc
  const wasPublished = previousDoc?._status === 'published'
  const isPublished = doc?._status === 'published'
  const action: AuditAction =
    operation === 'create'
      ? 'create'
      : !wasPublished && isPublished
        ? 'publish'
        : wasPublished && doc?._status === 'draft'
          ? 'unpublish'
          : 'update'
  await write(req, {
    action,
    target: collection.slug,
    docId: String(doc.id),
    changed: changedKeys(doc, previousDoc),
  })
  return doc
}

export const auditCollectionDelete: CollectionAfterDeleteHook = async ({
  collection,
  doc,
  req,
}) => {
  if (collection.slug !== AUDIT_COLLECTION)
    await write(req, { action: 'delete', target: collection.slug, docId: String(doc.id) })
  return doc
}

export const auditGlobalChange: GlobalAfterChangeHook = async ({
  global,
  doc,
  previousDoc,
  req,
}) => {
  await write(req, {
    action: 'update',
    target: `global:${global.slug}`,
    changed: changedKeys(doc, previousDoc),
  })
  return doc
}

export const auditLogin: CollectionAfterLoginHook = async ({ collection, user, req }) => {
  await write(req, {
    action: 'login',
    target: collection.slug,
    docId: String(user.id),
    userId: String(user.id),
  })
  return user
}

/** Second-factor lockout (repeated wrong TOTP codes), written by the totpGuard plugin. */
export async function auditMfaLockout(req: PayloadRequest, userId: string): Promise<void> {
  await write(req, { action: 'mfa-lockout', target: 'users', docId: userId, userId })
}
