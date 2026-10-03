import { TargetError, type TargetName } from './target'

type Options = {
  target: TargetName
  limit?: number
  dryRun: boolean
  concurrency: number
  overwriteEdited: boolean
}

const KEYS = new Set(['target', 'limit', 'concurrency', 'confirm'])
const WORDS = new Set(['dry-run', 'apply', 'overwrite-edited'])

/**
 * Strict: `payload run` silently drops `--flags`, so every option is a plain word and anything
 * unknown (a typo, a leftover `--`) stops the run instead of being ignored. Production is a dry
 * run unless the word `apply` is given as well as the confirmation token.
 */
export function parseArgs(argv: readonly string[]): Options {
  const kv = new Map<string, string>()
  for (const a of argv) {
    const i = a.indexOf('=')
    if (i > 0 && KEYS.has(a.slice(0, i))) kv.set(a.slice(0, i), a.slice(i + 1))
    else if (!WORDS.has(a)) throw new TargetError(`unknown option "${a.slice(0, 40)}"`)
  }
  const target = kv.get('target') ?? 'local'
  if (target !== 'local' && target !== 'production')
    throw new TargetError('target must be "local" or "production"')
  const limit = kv.has('limit') ? Number(kv.get('limit')) : undefined
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    throw new TargetError('limit must be a positive whole number')
  const concurrency = Number(kv.get('concurrency') ?? 3)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new TargetError('concurrency must be a whole number from 1 to 8')
  if (argv.includes('apply') && argv.includes('dry-run'))
    throw new TargetError('"apply" and "dry-run" cannot be used together')
  return {
    target,
    limit,
    dryRun: argv.includes('dry-run') || (target === 'production' && !argv.includes('apply')),
    concurrency,
    overwriteEdited: argv.includes('overwrite-edited'),
  }
}
