import { describe, expect, it } from 'vitest'
import type { Config } from 'payload'
import {
  capPublicReads,
  PUBLIC_MAX_DEPTH,
  PUBLIC_MAX_LIMIT,
  publicApiLimits,
} from '@/payload/plugins/publicApiLimits'

const run = (
  args: Record<string, unknown>,
  { operation = 'read', payloadAPI = 'REST', user = null as object | null } = {},
) =>
  capPublicReads({ args, operation, req: { payloadAPI, user } } as never) as Record<string, unknown>

describe('capPublicReads', () => {
  it('turns "every document" requests into one capped page', () => {
    expect(run({ pagination: false, limit: 0 })).toMatchObject({
      pagination: true,
      limit: PUBLIC_MAX_LIMIT,
    })
    expect(run({})).toMatchObject({ pagination: true, limit: PUBLIC_MAX_LIMIT })
  })

  it('caps big, negative and non-numeric limits but keeps small ones', () => {
    expect(run({ limit: 100000 }).limit).toBe(PUBLIC_MAX_LIMIT)
    expect(run({ limit: -5 }).limit).toBe(PUBLIC_MAX_LIMIT)
    expect(run({ limit: 'abc' }).limit).toBe(PUBLIC_MAX_LIMIT)
    expect(run({ limit: 12 }).limit).toBe(12)
  })

  it('never floors a fraction to 0, which the Mongo adapter reads as "no limit"', () => {
    // As REST delivers them: ?limit=0.5, ?limit[]=0.2, ?limit=1e-9.
    for (const limit of [0.5, '0.5', ['0.2'], '1e-9']) expect(run({ limit }).limit).toBe(1)
  })

  it('caps depth and pins an unset one to the cap', () => {
    expect(run({ depth: 4 }).depth).toBe(PUBLIC_MAX_DEPTH)
    expect(run({ depth: 0 }).depth).toBe(0)
    expect(run({ depth: -1 }).depth).toBe(0)
    expect(run({ depth: 'x' }).depth).toBe(0)
    expect(run({}).depth).toBe(PUBLIC_MAX_DEPTH)
  })

  it('leaves Payload’s own relationship population (currentDepth) alone', () => {
    const args = { pagination: false, currentDepth: 2, depth: 1 }
    expect(run(args)).toBe(args)
  })

  it('applies to distinct-value reads too', () => {
    expect(run({ limit: 0 }, { operation: 'readDistinct' }).limit).toBe(PUBLIC_MAX_LIMIT)
  })

  it('leaves the Local API, signed-in staff and other operations untouched', () => {
    const args = { pagination: false, limit: 0, depth: 4 }
    expect(run(args, { payloadAPI: 'local' })).toBe(args)
    expect(run(args, { user: { id: 'u1' } })).toBe(args)
    expect(run(args, { operation: 'count' })).toBe(args)
    expect(run(args, { operation: 'update' })).toBe(args)
  })
})

describe('publicApiLimits', () => {
  it('adds the cap after each collection’s own beforeOperation hooks', () => {
    const own = () => undefined
    const config = publicApiLimits()({
      collections: [
        { slug: 'posts', fields: [], hooks: { beforeOperation: [own] } },
        { slug: 'pages', fields: [] },
      ],
    } as unknown as Config) as Config
    expect(config.collections?.map((c) => c.hooks?.beforeOperation)).toEqual([
      [own, capPublicReads],
      [capPublicReads],
    ])
  })
})
