import type { CollectionBeforeOperationHook, Config, Plugin } from 'payload'

/**
 * Caps what one anonymous HTTP request can make the server load. Payload's REST API takes `limit`,
 * `depth` and `pagination` from the query string, and `?pagination=false` or `?limit=0` means "every
 * document": GET /api/posts?pagination=false&depth=4 builds thousands of posts with their relations
 * in memory, enough to exhaust the App Platform instance's RAM from a single URL.
 *
 * The public site never reads content over REST (pages use the Local API), so signed-out REST reads
 * are clamped to one page of PUBLIC_MAX_LIMIT documents at depth PUBLIC_MAX_DEPTH. Signed-in staff
 * (the admin) and the Local API are untouched. Register last, after every plugin that adds collections.
 */
export const PUBLIC_MAX_LIMIT = 50
export const PUBLIC_MAX_DEPTH = 1

/**
 * Missing, 0 ("no limit"), negative or non-numeric → the cap; otherwise 1…cap. Never 0: the Mongo
 * adapter turns limit 0 into "no pagination", so a fraction like ?limit=0.5 must not floor to it.
 */
const clampLimit = (limit: unknown): number => {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return PUBLIC_MAX_LIMIT
  return Math.max(1, Math.min(Math.floor(n), PUBLIC_MAX_LIMIT))
}

const clampDepth = (depth: unknown): number => {
  const n = Number(depth)
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), PUBLIC_MAX_DEPTH) : 0
}

export const capPublicReads: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (req.payloadAPI === 'local' || req.user) return args
  if (operation !== 'read' && operation !== 'readDistinct') return args
  const { currentDepth, depth, limit } = args as {
    currentDepth?: number
    depth?: unknown
    limit?: unknown
  }
  // Payload's own relationship population (currentDepth ≥ 2, never settable over REST): already
  // bounded by the capped outer page, and capping it would leave related docs unpopulated.
  if (currentDepth) return args
  return {
    ...args,
    limit: clampLimit(limit),
    pagination: true,
    depth: clampDepth(depth ?? PUBLIC_MAX_DEPTH),
  }
}

export const publicApiLimits =
  (): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: config.collections?.map((collection) => ({
      ...collection,
      hooks: {
        ...collection.hooks,
        beforeOperation: [...(collection.hooks?.beforeOperation ?? []), capPublicReads],
      },
    })),
  })
