import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../migration/lib/args'
import { redact } from '../../migration/lib/redact'
import { retryOnce } from '../../migration/lib/retry'
import { editedAfterMigration } from '../../migration/load/taxonomy'
import {
  LOCAL_MIGRATION_DB,
  PRODUCTION_CONFIRM_FLAG,
  resolveTarget,
  spacesEndpoint,
  withDatabase,
} from '../../migration/lib/target'

const LOCAL = { DATABASE_URL: 'mongodb://127.0.0.1:27017/islammalayalam_dev' }
const PROD = {
  ...LOCAL,
  MONGODB_URI:
    'mongodb+srv://user:secret@cluster0.example.mongodb.net/islammalayalam?retryWrites=true',
  DO_SPACES_BUCKET: 'bucket',
  DO_SPACES_ENDPOINT: 'blr1.digitaloceanspaces.com',
  DO_SPACES_CDN_ENDPOINT: 'https://bucket.blr1.cdn.digitaloceanspaces.com',
  DO_SPACES_FOLDER: '/islammalayalam/',
  DO_SPACES_KEY: 'key',
  DO_SPACES_SECRET: 'secret',
}

describe('migration target', () => {
  it('local: same local server, its own database and media folder, Spaces switched off', () => {
    const t = resolveTarget('local', LOCAL)
    expect(t.overrides.DATABASE_URL).toBe(`mongodb://127.0.0.1:27017/${LOCAL_MIGRATION_DB}`)
    expect(t.overrides.MEDIA_DIR).toBe('media-migration')
    expect(t.overrides.S3_BUCKET).toBe('')
    expect(t.overrides.ALLOW_REMOTE_DB).toBe('false')
  })

  it('local refuses a remote DATABASE_URL', () => {
    expect(() => resolveTarget('local', { DATABASE_URL: PROD.MONGODB_URI })).toThrow(
      /local MongoDB/,
    )
  })

  it('production needs the explicit confirmation flag and all keys', () => {
    expect(() => resolveTarget('production', PROD)).toThrow(PRODUCTION_CONFIRM_FLAG)
    expect(() =>
      resolveTarget('production', { ...PROD, DO_SPACES_SECRET: '' }, [PRODUCTION_CONFIRM_FLAG]),
    ).toThrow(/DO_SPACES_SECRET/)
    expect(() =>
      resolveTarget(
        'production',
        { ...PROD, MONGODB_URI: 'mongodb+srv://u:p@cluster0.example.mongodb.net/?x=1' },
        [PRODUCTION_CONFIRM_FLAG],
      ),
    ).toThrow(/no database name/)
  })

  it('production maps the owner’s key names onto the app settings, never into the description', () => {
    const t = resolveTarget('production', PROD, [PRODUCTION_CONFIRM_FLAG])
    expect(t.overrides).toMatchObject({
      DATABASE_URL: PROD.MONGODB_URI,
      S3_BUCKET: 'bucket',
      S3_REGION: 'blr1',
      S3_ENDPOINT: 'https://blr1.digitaloceanspaces.com',
      S3_PREFIX: 'islammalayalam',
      MEDIA_CDN_URL: 'https://bucket.blr1.cdn.digitaloceanspaces.com',
      ALLOW_REMOTE_DB: 'true',
    })
    expect(t.description).not.toMatch(/secret|user|cluster0|key/i)
  })

  it('helpers: database swap keeps options; Spaces endpoint forms', () => {
    expect(withDatabase('mongodb://h:1/a?x=1', 'b')).toBe('mongodb://h:1/b?x=1')
    expect(withDatabase('mongodb://h:1', 'b')).toBe('mongodb://h:1/b')
    expect(spacesEndpoint('https://bucket.sgp1.digitaloceanspaces.com/')).toEqual({
      endpoint: 'https://sgp1.digitaloceanspaces.com',
      region: 'sgp1',
    })
    expect(() => spacesEndpoint('http://blr1.digitaloceanspaces.com')).toThrow(/https/)
    expect(() => spacesEndpoint('s3.amazonaws.com')).toThrow(/Spaces/)
  })

  it('redact removes secret values and connection-string credentials from error text', () => {
    const env = { ...PROD, DO_SPACES_SECRET: 'sp4ces-s3cret-value' }
    const text = redact(
      `failed ${PROD.MONGODB_URI} and mongodb://other:pw@10.0.0.1/x signing with sp4ces-s3cret-value`,
      env,
    )
    expect(text).not.toMatch(/user:secret|other:pw|sp4ces-s3cret-value/)
    expect(text).toContain('[MONGODB_URI]')
    expect(text).toContain('mongodb://[redacted]@10.0.0.1/x')
    expect(text).toContain('[DO_SPACES_SECRET]')
  })

  it('redact hides remote database hosts and passwords that contain "@"', () => {
    const env = { MONGODB_URI: 'mongodb+srv://u:p@db-cluster.example.net/app' }
    expect(redact('server selection timed out on db-cluster.example.net', env)).toBe(
      'server selection timed out on [database host]',
    )
    expect(redact('mongodb://u:p@ss@10.0.0.1/x', {})).toBe('mongodb://[redacted]@10.0.0.1/x')
  })

  it('Spaces endpoint must be exactly a digitaloceanspaces.com host', () => {
    for (const bad of [
      'blr1.digitaloceanspaces.com.attacker.invalid',
      'digitaloceanspaces.com',
      'https://blr1.digitaloceanspaces.com:8443',
    ])
      expect(() => spacesEndpoint(bad), bad).toThrow(/Spaces/)
  })
})

describe('migration options', () => {
  it('rejects unknown words instead of ignoring them', () => {
    expect(() => parseArgs(['target=local', 'dryrun'])).toThrow(/unknown option/)
    expect(() => parseArgs(['targt=local'])).toThrow(/unknown option/)
    expect(() => parseArgs(['concurrency=50'])).toThrow(/concurrency/)
    expect(() => parseArgs(['apply', 'dry-run'])).toThrow(/cannot be used together/)
  })

  it('local writes by default; production is a dry run unless "apply" is given', () => {
    expect(parseArgs(['target=local']).dryRun).toBe(false)
    expect(parseArgs(['target=local', 'dry-run']).dryRun).toBe(true)
    expect(parseArgs(['target=production', PRODUCTION_CONFIRM_FLAG]).dryRun).toBe(true)
    expect(parseArgs(['target=production', PRODUCTION_CONFIRM_FLAG, 'apply']).dryRun).toBe(false)
  })

  it('a record saved after the migration wrote it counts as edited', () => {
    const at = '2026-09-30T10:00:00.000Z'
    expect(editedAfterMigration({ updatedAt: at, legacy: { migratedAt: at } })).toBe(false)
    expect(
      editedAfterMigration({ updatedAt: '2026-09-30T10:00:02.000Z', legacy: { migratedAt: at } }),
    ).toBe(false)
    expect(
      editedAfterMigration({ updatedAt: '2026-09-30T12:00:00.000Z', legacy: { migratedAt: at } }),
    ).toBe(true)
    expect(editedAfterMigration({ updatedAt: at })).toBe(false)
  })

  it('a failed database write is tried once more, never more', async () => {
    const validation = (message: string) =>
      Object.assign(new Error(message), { name: 'ValidationError' })
    let calls = 0
    let recovered = 0
    const flaky = async () => {
      calls += 1
      if (calls === 1) throw validation('The following field is invalid: File')
      return 'saved'
    }
    await expect(
      retryOnce(flaky, { delayMs: 0, onRecovered: () => (recovered += 1) }),
    ).resolves.toBe('saved')
    expect([calls, recovered]).toEqual([2, 1])

    calls = 0
    const mongo = Object.assign(new Error('NoSuchTransaction'), {
      hasErrorLabel: (label: string) => label === 'TransientTransactionError',
    })
    const transient = async () => {
      calls += 1
      if (calls === 1) throw mongo
      return 'saved'
    }
    await expect(retryOnce(transient, { delayMs: 0 })).resolves.toBe('saved')
    expect(calls).toBe(2)

    calls = 0
    const broken = async () => {
      calls += 1
      throw validation(`invalid field (attempt ${calls})`)
    }
    await expect(retryOnce(broken, { delayMs: 0 })).rejects.toThrow('attempt 2')
    expect(calls).toBe(2)

    calls = 0
    const duplicate = async () => {
      calls += 1
      throw new Error('E11000 duplicate key')
    }
    await expect(retryOnce(duplicate, { delayMs: 0 })).rejects.toThrow('E11000')
    expect(calls, 'other errors are not retried').toBe(1)

    calls = 0
    await expect(retryOnce(async () => (calls += 1), { delayMs: 0 })).resolves.toBe(1)
  })
})
