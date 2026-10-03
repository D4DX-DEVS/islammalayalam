import { z } from 'zod'

/**
 * Server environment, validated once at startup. Never import this from client components.
 *
 * Safety rails:
 * - Outside production, DATABASE_URL must point at localhost unless ALLOW_REMOTE_DB=true.
 * - Outside production, DigitalOcean Spaces is refused unless ALLOW_REMOTE_MEDIA=true.
 * - TOTP (admin MFA) can only be disabled when NODE_ENV=test.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
/** An empty value means "not set", so a script can switch a .env setting off with `NAME=`. */
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), type.optional())

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'DATABASE_URL must be a MongoDB connection string'),
    PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
    NEXT_PUBLIC_SERVER_URL: z.url().default('http://localhost:3444'),
    ALLOW_REMOTE_DB: z.enum(['true', 'false']).default('false'),
    ALLOW_REMOTE_MEDIA: z.enum(['true', 'false']).default('false'),
    TOTP_DISABLED: z.enum(['true', 'false']).default('false'),
    S3_BUCKET: optional(z.string()),
    S3_REGION: optional(z.string()),
    S3_ENDPOINT: optional(z.url()),
    S3_ACCESS_KEY_ID: optional(z.string()),
    S3_SECRET_ACCESS_KEY: optional(z.string()),
    /** Folder inside the bucket; files go to `<S3_PREFIX>/media/…`. */
    S3_PREFIX: optional(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/)),
    MEDIA_CDN_URL: optional(z.url()),
  })
  .superRefine((env, ctx) => {
    const prod = env.NODE_ENV === 'production'
    if (!prod && env.ALLOW_REMOTE_DB !== 'true' && !isLocalMongo(env.DATABASE_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'Non-production must use a local MongoDB (set ALLOW_REMOTE_DB=true to override deliberately)',
      })
    }
    const s3Keys = [
      'S3_BUCKET',
      'S3_REGION',
      'S3_ENDPOINT',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ] as const
    const present = s3Keys.filter((k) => env[k])
    if (present.length > 0 && present.length < s3Keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: `Spaces config is partial; missing ${s3Keys.filter((k) => !env[k]).join(', ')}`,
      })
    }
    if (!prod && present.length > 0 && env.ALLOW_REMOTE_MEDIA !== 'true') {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message:
          'Non-production must not use DigitalOcean Spaces (set ALLOW_REMOTE_MEDIA=true to override deliberately)',
      })
    }
    if (env.TOTP_DISABLED === 'true' && env.NODE_ENV !== 'test') {
      ctx.addIssue({
        code: 'custom',
        path: ['TOTP_DISABLED'],
        message: 'TOTP may only be disabled in NODE_ENV=test',
      })
    }
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

let cached: ServerEnv | undefined

export function getEnv(): ServerEnv {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid server environment:\n${issues}`)
  }
  cached = parsed.data
  return cached
}

export const spacesEnabled = (env: ServerEnv): boolean => Boolean(env.S3_BUCKET)
