import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { Secret, TOTP } from 'otpauth'
import { addDataAndFileToRequest } from 'payload'
import type { Config, PayloadHandler, PayloadRequest, Plugin } from 'payload'
import { auditMfaLockout } from '@/payload/hooks/auditLog'

/**
 * Hardens payload-totp's second factor (ASVS V2.8). The plugin's POST /api/verify-totp has no
 * attempt limit and accepts the same code again for as long as it is valid. This wraps it:
 *
 *  - Attempt limit: one attempt is reserved atomically ($inc) BEFORE the code is looked at, so even
 *    parallel guessing gets at most TOTP_MAX_ATTEMPTS tries per window. The last failure locks TOTP
 *    sign-in; each consecutive lockout doubles the lock (15 min → 30 min → … → 24 h), audited.
 *  - Replay protection: a code is accepted once. Its time step is claimed with a conditional update
 *    (must be newer than the last accepted step), so two parallel requests cannot both use it.
 *
 * State lives in its own collection (one document per user), written only with atomic driver
 * operations. It is deliberately NOT stored on `users`: Payload core rewrites the whole user
 * document during login/refresh/logout from values it read earlier, which would silently roll back
 * counters and locks under interleaved requests. Register after payloadTotp().
 */
export const TOTP_MAX_ATTEMPTS = 5
export const TOTP_LOCK_MS = 15 * 60 * 1000
export const TOTP_LOCK_MAX_MS = 24 * 60 * 60 * 1000
export const TOTP_GUARD_COLLECTION = 'totp_guard'
const USERS = 'users'
const VERIFY_PATH = '/verify-totp'
const LOCKED =
  'Too many incorrect codes. Sign-in with a code is locked for a while; try again later.'
const REPLAYED = 'That code was already used. Wait for the next code.'
const PROVISIONAL_LOCK = new Date(8.64e15) // latest representable date: "locked" until the real expiry is written

type TotpOptions = { algorithm?: string; digits?: number; period?: number }
export type TotpGuardDoc = {
  _id: string
  attempts: number
  lockouts: number
  lockedUntil: Date | null
  lastStep: number | null
}

const adapter = (req: PayloadRequest) => req.payload.db as unknown as MongooseAdapter
export const guardStore = (req: PayloadRequest) =>
  adapter(req).connection.collection<TotpGuardDoc>(TOTP_GUARD_COLLECTION)
const reply = (status: number, message: string): Response =>
  Response.json({ ok: false, message }, { status })

/** Lock length for the n-th consecutive lockout: 15 min, 30 min, 1 h … capped at 24 h. */
export const lockDuration = (lockouts: number): number =>
  Math.min(TOTP_LOCK_MS * 2 ** Math.max(0, lockouts - 1), TOTP_LOCK_MAX_MS)

function totpOptions(req: PayloadRequest): TotpOptions {
  const custom = req.payload.config.custom as
    | { totp?: { pluginOptions?: { totp?: TotpOptions } } }
    | undefined
  return custom?.totp?.pluginOptions?.totp ?? {}
}

/** Time step the code belongs to (±1 step of drift, like the plugin), or null if it is wrong. */
export function matchStep(
  token: unknown,
  secret: string,
  opts: TotpOptions,
  now = Date.now(),
): number | null {
  const digits = opts.digits ?? 6
  const period = opts.period ?? 30
  if (typeof token !== 'string' || !new RegExp(`^\\d{${digits}}$`).test(token)) return null
  try {
    const totp = new TOTP({
      algorithm: opts.algorithm ?? 'SHA1',
      digits,
      period,
      secret: Secret.fromBase32(secret),
    })
    const delta = totp.validate({ token, timestamp: now, window: 1 })
    return delta === null ? null : Math.floor(now / 1000 / period) + delta
  } catch {
    return null
  }
}

async function lockOut(req: PayloadRequest, id: string): Promise<Response> {
  const guard = guardStore(req)
  // Only the first of several concurrent failing requests takes the lock (and counts the lockout).
  const locked = await guard.findOneAndUpdate(
    { _id: id, lockedUntil: null },
    { $set: { lockedUntil: PROVISIONAL_LOCK }, $inc: { lockouts: 1 } },
    { returnDocument: 'after' },
  )
  if (locked) {
    await guard.updateOne(
      { _id: id, lockedUntil: PROVISIONAL_LOCK },
      { $set: { lockedUntil: new Date(Date.now() + lockDuration(locked.lockouts)) } },
    )
    req.payload.logger.warn({
      msg: 'TOTP verification locked after repeated failures',
      user: id,
      lockouts: locked.lockouts,
    })
    await auditMfaLockout(req, id)
  }
  return reply(429, LOCKED)
}

/** Wraps the plugin's verify handler; `verify` only runs for a fresh, correct, unlocked code. */
export function guardVerify(verify: PayloadHandler): PayloadHandler {
  return async (req) => {
    const user = req.user
    if (!user || user.collection !== USERS) return verify(req) // the plugin answers "unauthorized"
    const id = String(user.id)
    const guard = guardStore(req)
    await guard.updateOne(
      { _id: id },
      { $setOnInsert: { attempts: 0, lockouts: 0, lockedUntil: null, lastStep: null } },
      { upsert: true },
    )
    // An expired lock opens a fresh window (the lockout count stays, so the next lock is longer).
    await guard.updateOne(
      { _id: id, lockedUntil: { $lte: new Date() } },
      { $set: { attempts: 0, lockedUntil: null } },
    )
    const state = await guard.findOneAndUpdate(
      { _id: id, lockedUntil: null },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    )
    if (!state) return reply(429, LOCKED)
    if (state.attempts > TOTP_MAX_ATTEMPTS) return lockOut(req, id)

    if (!req.data) await addDataAndFileToRequest(req)
    const account = (await adapter(req)
      .collections[USERS]!.findById(id, { totpSecret: 1 })
      .lean()) as { totpSecret?: string | null } | null
    const step = account?.totpSecret
      ? matchStep(req.data?.token, account.totpSecret, totpOptions(req))
      : null
    if (step === null) {
      if (state.attempts >= TOTP_MAX_ATTEMPTS) return lockOut(req, id)
      const t = req.i18n.t as (key: string) => string // plugin keys are not in Payload's typed key set
      return reply(400, t('totpPlugin:setup:incorrectCode'))
    }
    const claimed = await guard.updateOne(
      { _id: id, $or: [{ lastStep: null }, { lastStep: { $lt: step } }] },
      { $set: { lastStep: step } },
    )
    if (claimed.modifiedCount === 0) return reply(400, REPLAYED)

    const res = await verify(req)
    const ok = await res
      .clone()
      .json()
      .then((body: { ok?: unknown }) => body.ok === true)
      .catch(() => false)
    if (ok) await guard.updateOne({ _id: id }, { $set: { attempts: 0, lockouts: 0 } })
    return res
  }
}

export const totpGuard =
  (): Plugin =>
  (config: Config): Config => {
    const endpoints = config.endpoints ?? []
    const target = endpoints.find((e) => e.path === VERIFY_PATH && e.method === 'post')
    if (!target) {
      const disabled = (
        config.custom as { totp?: { pluginOptions?: { disabled?: boolean } } } | undefined
      )?.totp?.pluginOptions?.disabled
      if (disabled) return config // MFA off (NODE_ENV=test only): nothing to guard
      throw new Error('totpGuard() must be registered after payloadTotp()')
    }
    return {
      ...config,
      endpoints: endpoints.map((e) =>
        e === target ? { ...e, handler: guardVerify(e.handler) } : e,
      ),
    }
  }
