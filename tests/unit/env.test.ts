import { describe, expect, it } from 'vitest'
import { parseServerEnv, spacesConfig } from '@/lib/env'
import { cdnUrl, spacesEndpoint, spacesFolder } from '@/lib/spaces'

const LIVE_DB =
  'mongodb+srv://user:secret@cluster0.example.mongodb.net/islammalayalam?retryWrites=true'
const BASE = { NODE_ENV: 'development', MONGODB_URI: LIVE_DB, PAYLOAD_SECRET: 'x'.repeat(32) }
const SPACES = {
  DO_SPACES_BUCKET: 'bucket',
  DO_SPACES_ENDPOINT: 'blr1.digitaloceanspaces.com',
  DO_SPACES_KEY: 'key',
  DO_SPACES_SECRET: 'spaces-secret-value',
  DO_SPACES_CDN_ENDPOINT: 'bucket.blr1.cdn.digitaloceanspaces.com/',
  DO_SPACES_FOLDER: '/ISLAMMALAYALAM/',
}
const NO_SPACES = {
  DO_SPACES_BUCKET: '',
  DO_SPACES_ENDPOINT: '',
  DO_SPACES_KEY: '',
  DO_SPACES_SECRET: '',
  DO_SPACES_CDN_ENDPOINT: '',
}

describe('server env: database', () => {
  it('reads MONGODB_URI, the same remote database locally and in production', () => {
    expect(parseServerEnv(BASE).MONGODB_URI).toBe(LIVE_DB)
    expect(parseServerEnv({ ...BASE, NODE_ENV: 'production' }).MONGODB_URI).toBe(LIVE_DB)
  })

  it('never falls back to DATABASE_URL', () => {
    const { MONGODB_URI: _, ...rest } = BASE
    expect(() =>
      parseServerEnv({ ...rest, DATABASE_URL: 'mongodb://127.0.0.1:27017/islammalayalam_dev' }),
    ).toThrow(/MONGODB_URI/)
  })

  it('refuses a non-MongoDB URL or one without a database name', () => {
    expect(() => parseServerEnv({ ...BASE, MONGODB_URI: 'https://example.com/db' })).toThrow(
      /MONGODB_URI must be a MongoDB connection string/,
    )
    expect(() =>
      parseServerEnv({ ...BASE, MONGODB_URI: 'mongodb+srv://u:p@cluster0.example.net/?x=1' }),
    ).toThrow(/database name/)
  })

  it('NODE_ENV=test can never reach a remote database or Spaces', () => {
    expect(() => parseServerEnv({ ...BASE, NODE_ENV: 'test' })).toThrow(/local MongoDB/)
    const localTest = { ...BASE, NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1:27017/x_test' }
    expect(parseServerEnv({ ...localTest, ...NO_SPACES }).NODE_ENV).toBe('test')
    expect(() => parseServerEnv({ ...localTest, ...SPACES })).toThrow(/Spaces/)
  })
})

describe('server env: DigitalOcean Spaces', () => {
  it('maps DO_SPACES_* onto the storage settings', () => {
    expect(spacesConfig(parseServerEnv({ ...BASE, ...SPACES }))).toEqual({
      bucket: 'bucket',
      endpoint: 'https://blr1.digitaloceanspaces.com',
      region: 'blr1',
      accessKeyId: 'key',
      secretAccessKey: 'spaces-secret-value',
      prefix: 'ISLAMMALAYALAM',
      cdnUrl: 'https://bucket.blr1.cdn.digitaloceanspaces.com',
    })
  })

  it('is off when unset or blanked (a script switches it off with NAME=)', () => {
    expect(spacesConfig(parseServerEnv(BASE))).toBeNull()
    expect(spacesConfig(parseServerEnv({ ...BASE, ...SPACES, ...NO_SPACES }))).toBeNull()
  })

  it('refuses partial or invalid settings without echoing any value', () => {
    const fails = (over: Record<string, string>, reason: RegExp) => {
      let message = ''
      try {
        parseServerEnv({ ...BASE, ...SPACES, ...over })
      } catch (err) {
        message = (err as Error).message
      }
      expect(message).toMatch(reason)
      expect(message).not.toMatch(/spaces-secret-value|cluster0|user:secret/)
    }
    fails({ DO_SPACES_SECRET: '' }, /missing DO_SPACES_SECRET/)
    fails({ DO_SPACES_ENDPOINT: 's3.amazonaws.com' }, /DO_SPACES_ENDPOINT/)
    fails({ DO_SPACES_CDN_ENDPOINT: 'http://cdn.example.com' }, /DO_SPACES_CDN_ENDPOINT/)
    fails({ DO_SPACES_FOLDER: 'a b' }, /DO_SPACES_FOLDER/)
  })
})

describe('spaces helpers', () => {
  it('endpoint: regional or bucket host, https only, Spaces only', () => {
    expect(spacesEndpoint('https://bucket.sgp1.digitaloceanspaces.com/')).toEqual({
      endpoint: 'https://sgp1.digitaloceanspaces.com',
      region: 'sgp1',
    })
    expect(() => spacesEndpoint('http://blr1.digitaloceanspaces.com')).toThrow(/https/)
    expect(() => spacesEndpoint('s3.amazonaws.com')).toThrow(/Spaces/)
    expect(() => spacesEndpoint('blr1.digitaloceanspaces.com.evil.net')).toThrow(/Spaces/)
  })

  it('CDN URL: host or https URL, no trailing slash; anything else is undefined', () => {
    expect(cdnUrl('bucket.blr1.cdn.digitaloceanspaces.com')).toBe(
      'https://bucket.blr1.cdn.digitaloceanspaces.com',
    )
    expect(cdnUrl('https://cdn.example.com/base/')).toBe('https://cdn.example.com/base')
    expect(cdnUrl('http://cdn.example.com')).toBeUndefined()
    expect(cdnUrl('')).toBeUndefined()
    expect(cdnUrl(undefined)).toBeUndefined()
  })

  it('folder: surrounding slashes dropped', () => {
    expect(spacesFolder('/ISLAMMALAYALAM/')).toBe('ISLAMMALAYALAM')
    expect(spacesFolder(undefined)).toBe('')
  })
})
