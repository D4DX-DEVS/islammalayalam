import { describe, expect, it } from 'vitest'
import { isLiveData, parseServerEnv } from '@/lib/env'

/** Development refuses the live data unless asked for it on purpose (npm run dev:live). */
const base = {
  PAYLOAD_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3444',
}
const local = 'mongodb://127.0.0.1:27017/islammalayalam_dev'
const remote = 'mongodb+srv://user:pass@db.example.invalid/islammalayalam?tls=true'
const spaces = {
  DO_SPACES_BUCKET: 'bucket',
  DO_SPACES_ENDPOINT: 'blr1.digitaloceanspaces.com',
  DO_SPACES_KEY: 'key',
  DO_SPACES_SECRET: 'secret',
}

describe('development data rail', () => {
  it('accepts the local database and local media', () => {
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: 'development', MONGODB_URI: local }),
    ).not.toThrow()
  })

  it('refuses a remote database in development, naming the way out', () => {
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: 'development', MONGODB_URI: remote }),
    ).toThrow(/npm run dev:live/)
  })

  it('refuses Spaces in development even with a local database', () => {
    expect(() =>
      parseServerEnv({ ...base, ...spaces, NODE_ENV: 'development', MONGODB_URI: local }),
    ).toThrow(/local media/)
  })

  it('allows the live data when ALLOW_LIVE_DATA=yes (npm run dev:live)', () => {
    expect(() =>
      parseServerEnv({
        ...base,
        ...spaces,
        NODE_ENV: 'development',
        MONGODB_URI: remote,
        ALLOW_LIVE_DATA: 'yes',
      }),
    ).not.toThrow()
  })

  it('does not get in the way of production', () => {
    expect(() =>
      parseServerEnv({ ...base, ...spaces, NODE_ENV: 'production', MONGODB_URI: remote }),
    ).not.toThrow()
  })

  it('never lets ALLOW_LIVE_DATA weaken the test rail', () => {
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: 'test', MONGODB_URI: remote, ALLOW_LIVE_DATA: 'yes' }),
    ).toThrow(/local MongoDB/)
  })
})

describe('isLiveData', () => {
  it('is false for a local database without Spaces', () => {
    expect(isLiveData({ MONGODB_URI: local, DO_SPACES_BUCKET: undefined })).toBe(false)
  })
  it('is true for a remote database or for Spaces', () => {
    expect(isLiveData({ MONGODB_URI: remote, DO_SPACES_BUCKET: undefined })).toBe(true)
    expect(isLiveData({ MONGODB_URI: local, DO_SPACES_BUCKET: 'bucket' })).toBe(true)
  })
})
