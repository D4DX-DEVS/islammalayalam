import {
  buildUserMessage,
  cleanQuestion,
  parseAnswer,
  type PromptSource,
  type Segment,
} from '@/features/ai-search/text'
import { searchNormalize } from '@/lib/text/search'
import type { DailyBudget, RateLimiter, TtlCache } from '@/features/ai-search/limits'

/**
 * The AI search flow with its dependencies injected (retrieval, the model call, the cost guards),
 * so it is unit-tested without a database or an API key. service.ts wires the real ones.
 */
export interface AiSource {
  n: number
  title: string
  href: string
  category: string | null
}
export interface Retrieved extends AiSource {
  snippet: string
}

export type AiResult =
  | { status: 'ok'; paragraphs: Segment[][]; sources: AiSource[] }
  | { status: 'no-results' }
  | { status: 'invalid' }
  | { status: 'limited' }
  | { status: 'refused' }
  | { status: 'unavailable' }

export type ModelOutcome = { kind: 'text'; text: string } | { kind: 'refusal' }

export interface AiDeps {
  retrieve: (question: string) => Promise<Retrieved[]>
  ask: (system: string, user: string) => Promise<ModelOutcome>
  system: string
  perVisitor: RateLimiter
  daily: DailyBudget
  cache: TtlCache<CachedAnswer>
}

/** Thrown by the fresh step so a failure is never stored as an answer. */
export class AiFailure extends Error {
  constructor(readonly status: 'limited' | 'refused' | 'unavailable') {
    super(status)
  }
}

export type CachedAnswer =
  | { status: 'ok'; paragraphs: Segment[][]; sources: AiSource[] }
  | { status: 'no-results' }

/**
 * Retrieve → ask → parse. Only successful answers (and "nothing found") are returned; limits and
 * model problems throw AiFailure so the caller's cache never keeps them.
 */
export async function answerFresh(
  deps: AiDeps,
  question: string,
  visitor: string,
): Promise<CachedAnswer> {
  const found = await deps.retrieve(question)
  if (!found.length) return { status: 'no-results' }
  if (!deps.perVisitor.take(visitor) || !deps.daily.take()) throw new AiFailure('limited')

  const promptSources: PromptSource[] = found.map((s) => ({
    n: s.n,
    title: s.title,
    snippet: s.snippet,
  }))
  let outcome: ModelOutcome
  try {
    outcome = await deps.ask(deps.system, buildUserMessage(question, promptSources))
  } catch {
    throw new AiFailure('unavailable')
  }
  if (outcome.kind === 'refusal') throw new AiFailure('refused')

  const { paragraphs, cited } = parseAnswer(outcome.text, new Set(found.map((s) => s.n)))
  if (!paragraphs.length) throw new AiFailure('unavailable')
  // Cited articles first (in the order the answer uses them), then the other candidates.
  const order = [...cited, ...found.map((s) => s.n).filter((n) => !cited.includes(n))]
  const sources = order.map((n) => {
    const s = found.find((f) => f.n === n)!
    return { n: s.n, title: s.title, href: s.href, category: s.category }
  })
  return { status: 'ok', paragraphs, sources }
}

export async function runAiSearch(
  deps: AiDeps,
  rawQuestion: string | undefined,
  visitor: string,
): Promise<AiResult> {
  const question = cleanQuestion(rawQuestion)
  if (!question) return { status: 'invalid' }
  // The same question, however it is typed (case, joiners, spacing), shares one answer.
  const key = searchNormalize(question)
  const known = deps.cache.get(key)
  if (known) return known
  try {
    const fresh = await answerFresh(deps, question, visitor)
    deps.cache.set(key, fresh)
    return fresh
  } catch (error) {
    return error instanceof AiFailure ? { status: error.status } : { status: 'unavailable' }
  }
}
