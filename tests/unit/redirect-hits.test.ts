import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Redirect rows count the visits they actually serve, after the response, in production only. */
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}))
const scheduled: (() => Promise<void>)[] = []
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => scheduled.push(fn) }))

type Row = { id: string; from: string; to?: string | null; code: '301' | '308' | '410' }
let rows: Row[] = []
const updateOne = vi.fn()
const payload = {
  find: vi.fn(async ({ where }: { where: { from: { equals: string } } }) => ({
    docs: rows.filter((r) => r.from === where.from.equals),
  })),
  db: { collections: { redirects: { updateOne } } },
  logger: { warn: vi.fn() },
}
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
vi.mock('@/features/posts/queries', () => ({
  findPostNumberByLegacySlug: async () => null,
  getPostByNumber: async () => null,
  getPostPreview: async () => null,
}))
vi.mock('@/features/pages/queries', () => ({ getPageByPath: async () => null }))
vi.mock('@/features/preview/session', () => ({ getPreviewUser: async () => null }))

const { movedTo, resolvePath } = await import('@/features/routing/resolve')
const { countRedirectHit } = await import('@/features/redirects/queries')

const flush = async () => {
  for (const fn of scheduled.splice(0)) await fn()
}

beforeEach(() => {
  rows = []
  scheduled.length = 0
  updateOne.mockReset()
  vi.stubEnv('NODE_ENV', 'production')
})
afterEach(() => vi.unstubAllEnvs())

describe('redirect hit counting', () => {
  it('counts a served 301 once, as a raw $inc on that row', async () => {
    rows = [{ id: 'r1', from: '/old-page/', to: '/new-page/', code: '301' }]
    expect(await resolvePath(['old-page'])).toEqual({ kind: 'redirect', to: '/new-page/' })
    expect(updateOne).not.toHaveBeenCalled() // nothing runs before the response is sent
    await flush()
    expect(updateOne).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledWith({ _id: 'r1' }, { $inc: { hits: 1 } })
  })

  it('counts a 410 Gone row', async () => {
    rows = [{ id: 'g1', from: '/category/banking/', code: '410' }]
    expect(await resolvePath(['category', 'banking'])).toEqual({ kind: 'gone' })
    await flush()
    expect(updateOne).toHaveBeenCalledWith({ _id: 'g1' }, { $inc: { hits: 1 } })
  })

  it('counts a renamed category served through movedTo', async () => {
    rows = [{ id: 'c1', from: '/category/old/', to: '/category/new/', code: '301' }]
    expect(await movedTo('/category/old/')).toBe('/category/new/')
    await flush()
    expect(updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { $inc: { hits: 1 } })
  })

  it('does not count rows that serve nothing (self-redirect, unsafe target)', async () => {
    rows = [
      { id: 's1', from: '/loop/', to: '/loop/', code: '301' },
      { id: 'u1', from: '/bad/', to: 'http://insecure.invalid/', code: '301' },
    ]
    expect(await movedTo('/loop/')).toBeNull()
    expect(await movedTo('/bad/')).toBeNull()
    await flush()
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('never writes an id-less filter (would match an arbitrary row)', async () => {
    countRedirectHit(undefined) // e.g. a cached lookup written before ids were kept
    countRedirectHit('')
    await flush()
    expect(scheduled).toHaveLength(0)
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('does not count outside production (local dev shares the live database)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    rows = [{ id: 'r1', from: '/old-page/', to: '/new-page/', code: '301' }]
    expect(await movedTo('/old-page/')).toBe('/new-page/')
    await flush()
    expect(scheduled).toHaveLength(0)
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('logs instead of failing when the count cannot be written', async () => {
    updateOne.mockRejectedValueOnce(new Error('db down'))
    rows = [{ id: 'r1', from: '/old-page/', to: '/new-page/', code: '301' }]
    await movedTo('/old-page/')
    await expect(flush()).resolves.toBeUndefined()
    expect(payload.logger.warn).toHaveBeenCalled()
  })
})
