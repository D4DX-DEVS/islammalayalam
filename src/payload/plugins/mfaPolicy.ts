import type { Access, CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'
import { isEnrolled } from '@/payload/access'

/**
 * Makes payload-totp follow Settings → Security (src/payload/mfa.ts) instead of its static options.
 * Register directly after payloadTotp(), which must be configured with `disableAccessWrapper: true`.
 *
 *  - Access: replaces the plugin's wrapper. A signed-in session that has not finished the sign-in
 *    steps the site requires gets nothing from any collection or global, including operations that
 *    fall back to Payload's "any signed-in user" default. Anonymous requests are left to the
 *    entity's own rule (public reads stay public, everything else stays closed).
 *  - Admin redirects: swaps the plugin's provider (which always forces setup) for ours, which sends
 *    users to the QR setup or the code screen only while the setting is on.
 */
const PLUGIN_PROVIDER = 'payload-totp/rsc#TOTPProvider'
const OUR_PROVIDER = '/payload/admin/mfa/MfaProvider#MfaProvider'
const COLLECTION_OPS = ['create', 'read', 'readVersions', 'update', 'delete', 'unlock'] as const
const GLOBAL_OPS = ['read', 'readVersions', 'update'] as const

export const requireSignIn =
  (inner?: Access): Access =>
  (args) => {
    const user = args.req.user
    if (user && !isEnrolled(user)) return false
    return inner ? inner(args) : Boolean(user)
  }

function wrap<T extends string>(access: Partial<Record<T, Access>> | undefined, ops: readonly T[]) {
  const next: Partial<Record<T, Access>> = { ...access }
  for (const op of ops) next[op] = requireSignIn(access?.[op])
  return next
}

const providerPath = (p: unknown): string | undefined =>
  typeof p === 'string' ? p : (p as { path?: string } | null)?.path

export const mfaPolicy =
  (): Plugin =>
  (config: Config): Config => {
    const custom = config.custom as
      | { totp?: { pluginOptions?: { disabled?: boolean; disableAccessWrapper?: boolean } } }
      | undefined
    const options = custom?.totp?.pluginOptions
    if (!options) throw new Error('mfaPolicy() must be registered after payloadTotp()')
    if (options.disabled) return config // MFA off (NODE_ENV=test only): nothing to apply
    if (!options.disableAccessWrapper)
      throw new Error('payloadTotp() needs disableAccessWrapper: true when mfaPolicy() is used')

    const providers = config.admin?.components?.providers ?? []
    if (!providers.some((p) => providerPath(p) === PLUGIN_PROVIDER))
      throw new Error('mfaPolicy(): payload-totp admin provider not found')

    return {
      ...config,
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          providers: providers.map((p) => (providerPath(p) === PLUGIN_PROVIDER ? OUR_PROVIDER : p)),
        },
      },
      collections: (config.collections ?? []).map(
        (c): CollectionConfig => ({
          ...c,
          access: { ...c.access, ...wrap(c.access, COLLECTION_OPS) },
        }),
      ),
      globals: (config.globals ?? []).map(
        (g): GlobalConfig => ({ ...g, access: { ...g.access, ...wrap(g.access, GLOBAL_OPS) } }),
      ),
    }
  }
