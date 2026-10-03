import { z } from 'zod'
import { cdnUrl, spacesEndpoint, spacesFolder } from '@/lib/spaces'

/**
 * Server environment, validated once at startup. Never import this from client components.
 *
 * - The database is MONGODB_URI and media storage is DigitalOcean Spaces (DO_SPACES_*): the same
 *   names and values locally and in production, so local development works on the live data.
 * - NODE_ENV=test may only use a local MongoDB and never Spaces: tests cannot touch live data.
 * - TOTP (admin MFA) can only be disabled when NODE_ENV=test.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
/** Spaces is on when these are set: all of them or none. */
const SPACES_KEYS = [
  'DO_SPACES_BUCKET',
  'DO_SPACES_ENDPOINT',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
] as const
const FOLDER = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/
/** An empty value means "not set", so a script can switch a .env setting off with `NAME=`. */
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), type.optional())

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must be a MongoDB connection string')
      .regex(
        /^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/,
        'MONGODB_URI must include the database name (…/<name>?…)',
      ),
    PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
    NEXT_PUBLIC_SERVER_URL: z.url().default('http://localhost:3444'),
    TOTP_DISABLED: z.enum(['true', 'false']).default('false'),
    DO_SPACES_BUCKET: optional(z.string()),
    /** Regional endpoint (`blr1.digitaloceanspaces.com`) or bucket host; the region comes from it. */
    DO_SPACES_ENDPOINT: optional(z.string()),
    DO_SPACES_KEY: optional(z.string()),
    DO_SPACES_SECRET: optional(z.string()),
    /** CDN host or URL; when set, media URLs point straight at the CDN. */
    DO_SPACES_CDN_ENDPOINT: optional(z.string()),
    /** Folder inside the bucket; files go to `<folder>/media/…`. */
    DO_SPACES_FOLDER: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    const present = SPACES_KEYS.filter((k) => env[k])
    if (present.length > 0 && present.length < SPACES_KEYS.length) {
      const missing = SPACES_KEYS.filter((k) => !env[k]).join(', ')
      issue('DO_SPACES_BUCKET', `Spaces config is partial; missing ${missing}`)
    }
    if (env.DO_SPACES_ENDPOINT) {
      try {
        spacesEndpoint(env.DO_SPACES_ENDPOINT)
      } catch (err) {
        issue('DO_SPACES_ENDPOINT', (err as Error).message)
      }
    }
    if (env.DO_SPACES_CDN_ENDPOINT && !cdnUrl(env.DO_SPACES_CDN_ENDPOINT))
      issue('DO_SPACES_CDN_ENDPOINT', 'DO_SPACES_CDN_ENDPOINT must be an https URL or a host name')
    const folder = spacesFolder(env.DO_SPACES_FOLDER)
    if (folder && !FOLDER.test(folder))
      issue('DO_SPACES_FOLDER', 'DO_SPACES_FOLDER may only contain letters, digits, . _ - and /')
    if (env.NODE_ENV === 'test') {
      if (!isLocalMongo(env.MONGODB_URI))
        issue('MONGODB_URI', 'NODE_ENV=test must use a local MongoDB')
      if (present.length > 0)
        issue('DO_SPACES_BUCKET', 'NODE_ENV=test must not use DigitalOcean Spaces')
    }
    if (env.TOTP_DISABLED === 'true' && env.NODE_ENV !== 'test')
      issue('TOTP_DISABLED', 'TOTP may only be disabled in NODE_ENV=test')
  })

function isLocalMongo(url: string): boolean {
  try {
    const host = url.replace(/^mongodb(\+srv)?:\/\//, 'http://').replace(/\/\/[^@/]*@/, '//')
    return LOCAL_HOSTS.has(new URL(host).hostname.replace(/^\[|\]$/g, ''))
  } catch {
    return false
  }
}

export type ServerEnv = z.infer<typeof schema>

/** Validate an environment; the error names each setting and reason, never a value. */
export function parseServerEnv(source: Readonly<Record<string, string | undefined>>): ServerEnv {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid server environment:\n${issues}`)
  }
  return parsed.data
}

let cached: ServerEnv | undefined

export function getEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env)
  return cached
}

export interface SpacesConfig {
  bucket: string
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Folder inside the bucket ('' = bucket root). */
  prefix: string
  cdnUrl?: string
}

/** Settings for the S3 storage adapter, or null when Spaces is not configured. */
export function spacesConfig(env: ServerEnv): SpacesConfig | null {
  if (!env.DO_SPACES_BUCKET) return null
  const { endpoint, region } = spacesEndpoint(env.DO_SPACES_ENDPOINT!)
  return {
    bucket: env.DO_SPACES_BUCKET,
    endpoint,
    region,
    accessKeyId: env.DO_SPACES_KEY!,
    secretAccessKey: env.DO_SPACES_SECRET!,
    prefix: spacesFolder(env.DO_SPACES_FOLDER),
    cdnUrl: cdnUrl(env.DO_SPACES_CDN_ENDPOINT),
  }
}
