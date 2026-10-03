import { randomBytes } from 'node:crypto'

/**
 * Integration-test environment. Set BEFORE the Payload config is imported (setupFiles run first).
 * Deliberately does NOT load .env: tests must never see development data or credentials.
 */
export const TEST_DATABASE_URL = 'mongodb://127.0.0.1:27017/islammalayalam_test'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  PAYLOAD_SECRET: process.env.TEST_PAYLOAD_SECRET ?? randomBytes(32).toString('hex'),
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3444',
  ALLOW_REMOTE_DB: 'false',
  ALLOW_REMOTE_MEDIA: 'false',
  // MFA stays ENABLED so access tests exercise the real payload-totp wrappers.
  TOTP_DISABLED: 'false',
})
for (const key of [
  'S3_BUCKET',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'MEDIA_CDN_URL',
])
  delete process.env[key]
