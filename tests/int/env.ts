import { randomBytes } from 'node:crypto'

/**
 * Integration-test environment. Set BEFORE the Payload config is imported (setupFiles run first).
 * Deliberately does NOT load .env: tests must never see the live database, media or credentials
 * (src/lib/env.ts also refuses a remote MongoDB or Spaces when NODE_ENV=test).
 */
export const TEST_DATABASE_URL = 'mongodb://127.0.0.1:27017/islammalayalam_test'

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: TEST_DATABASE_URL,
  PAYLOAD_SECRET: process.env.TEST_PAYLOAD_SECRET ?? randomBytes(32).toString('hex'),
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3444',
  // MFA stays ENABLED so access tests exercise the real payload-totp wrappers.
  TOTP_DISABLED: 'false',
  // Empty = not set. An existing value also wins over .env, should anything load it later.
  DO_SPACES_BUCKET: '',
  DO_SPACES_ENDPOINT: '',
  DO_SPACES_KEY: '',
  DO_SPACES_SECRET: '',
  DO_SPACES_CDN_ENDPOINT: '',
  DO_SPACES_FOLDER: '',
})
