import { describe, expect, it } from 'vitest'
import { spacesEndpoint } from '@/lib/spaces'
import { parseArgs } from '../../migration/lib/args'
import { redact } from '../../migration/lib/redact'
import { retryOnce } from '../../migration/lib/retry'
import { editedAfterMigration } from '../../migration/load/taxonomy'
import {
  LOCAL_MIGRATION_DB,
  PRODUCTION_CONFIRM_FLAG,
  resolveTarget,
} from '../../migration/lib/target'

const PROD = {
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
  it('local: local server, its own database and media folder, Spaces switched off', () => {
    // The live MONGODB_URI / DO_SPACES_* in .env are replaced, never used.
    const t = resolveTarget('local', PROD)
    expect(t.overrides.MONGODB_URI).toBe(`mongodb://127.0.0.1:27017/${LOCAL_MIGRATION_DB}`)
    expect(t.overrides.MEDIA_DIR).toBe('media-migration')
    for (const k of [
      'DO_SPACES_BUCKET',
      'DO_SPACES_ENDPOINT',
      'DO_SPACES_KEY',
      'DO_SPACES_SECRET',
      'DO_SPACES_CDN_ENDPOINT',
      'DO_SPACES_FOLDER',
    ])
      expect(t.overrides[k]).toBe('')
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

  it('production uses the owner’s .env names as they are (the app reads the same names)', () => {
    const t = resolveTarget('production', PROD, [PRODUCTION_CONFIRM_FLAG])
    expect(t.overrides).toEqual({ MEDIA_DIR: '' })
    expect(t.description).toContain('"islammalayalam"')
    expect(t.description).toContain('blr1, folder "islammalayalam"')
    expect(t.description).not.toMatch(/secret|user|cluster0|key/i)
  })

  it('production refuses a localhost database and bad Spaces settings', () => {
    const run = (over: Record<string, string>) => () =>
      resolveTarget('production', { ...PROD, ...over }, [PRODUCTION_CONFIRM_FLAG])
    expect(run({ MONGODB_URI: 'mongodb://127.0.0.1:27017/islammalayalam' })).toThrow(/localhost/)
    expect(run({ DO_SPACES_ENDPOINT: 's3.amazonaws.com' })).toThrow(/Spaces endpoint/)
    expect(run({ DO_SPACES_CDN_ENDPOINT: 'http://cdn.example.com' })).toThrow(/https/)
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
