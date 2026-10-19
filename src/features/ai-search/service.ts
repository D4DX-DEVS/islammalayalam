import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getEnv } from '@/lib/env'
import { getPayloadClient } from '@/lib/payload'
import { postHref } from '@/lib/links'
import { searchNormalize } from '@/lib/text/search'
import { POPULATE } from '@/features/shared'
import {
  runAiSearch,
  type AiDeps,
  type AiResult,
  type CachedAnswer,
  type ModelOutcome,
  type Retrieved,
} from '@/features/ai-search/core'
import { DailyBudget, RateLimiter, TtlCache } from '@/features/ai-search/limits'
import type { Where } from 'payload'
import { SYSTEM_PROMPT, searchTerms, snippetFor } from '@/features/ai-search/text'
import type { Category } from '@/payload-types'

/**
 * AI search, wired to the real database and the Claude API. Everything here runs on the server: the
 * API key never reaches the browser, and the model only ever sees the visitor's question and short
 * excerpts of published articles (found with the same Payload queries as ordinary search).
 */
const DEFAULT_MODEL = 'claude-opus-5-5'
const MAX_SOURCES = 5
const CANDIDATES = 40
const PER_VISITOR = { max: 6, windowMs: 10 * 60_000 }
const ANSWER_TTL_MS = 6 * 60 * 60_000
const DEFAULT_DAILY_LIMIT = 300

export const aiSearchConfigured = (): boolean => Boolean(getEnv().ANTHROPIC_API_KEY)
/** Show the AI buttons: always once configured, and in local development so the feature is visible. */
export const aiSearchUiEnabled = (): boolean =>
  aiSearchConfigured() || getEnv().NODE_ENV === 'development'

const count = (haystack: string, needle: string, cap: number): number => {
  let n = 0
  for (let i = haystack.indexOf(needle); i >= 0 && n < cap; i = haystack.indexOf(needle, i + 1)) n++
  return n
}

/** Published articles that mention the question's words, best matches first, with a relevant excerpt. */
async function retrieve(question: string): Promise<Retrieved[]> {
  const terms = searchTerms(question)
  if (!terms.length) return []
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { _status: { equals: 'published' } },
        // searchKey is the normalised title + summary; searchText is the raw full text.
        {
          or: terms.flatMap((t): Where[] => [
            { searchKey: { like: t } },
            { searchText: { like: t } },
          ]),
        },
      ],
    },
    sort: '-publishedAt',
    limit: CANDIDATES,
    depth: 1,
    select: { title: true, postNumber: true, primaryCategory: true, searchText: true },
    populate: POPULATE,
    draft: false,
    overrideAccess: true, // searchText is a server-only field; published-only is pinned above
  })

  return res.docs
    .map((doc) => {
      const title = searchNormalize(doc.title)
      const text = searchNormalize(doc.searchText ?? '')
      const score = terms.reduce(
        (sum, t) => sum + (title.includes(t) ? 3 : 0) + count(text, t, 4),
        0,
      )
      return { doc, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
    .map(({ doc }, i): Retrieved => {
      const category =
        doc.primaryCategory && typeof doc.primaryCategory === 'object'
          ? (doc.primaryCategory as Category).name
          : null
      return {
        n: i + 1,
        title: doc.title,
        href: postHref(doc.postNumber) ?? '/',
        category,
        snippet: snippetFor(doc.searchText ?? doc.title, terms),
      }
    })
}

let client: Anthropic | undefined
const getClient = (): Anthropic =>
  (client ??= new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 }))

/**
 * One Claude call. Opus 5.5 always thinks, so effort is set to `low` (a grounded summary needs
 * little reasoning); `fallbacks: 'default'` lets the API re-run a policy-declined request on its
 * default substitute model instead of failing.
 */
async function ask(system: string, user: string): Promise<ModelOutcome> {
  const response = await getClient().beta.messages.create({
    model: getEnv().AI_SEARCH_MODEL ?? DEFAULT_MODEL,
    max_tokens: 4_000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (response.stop_reason === 'refusal') return { kind: 'refusal' }
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n\n')
    .trim()
  if (!text) throw new Error('The model returned no text')
  return { kind: 'text', text }
}

// One set of guards per server process, kept across hot reloads in development.
const globalForAi = globalThis as unknown as { aiSearchDeps?: AiDeps }
function deps(): AiDeps {
  return (globalForAi.aiSearchDeps ??= {
    retrieve,
    ask,
    system: SYSTEM_PROMPT,
    perVisitor: new RateLimiter(PER_VISITOR.max, PER_VISITOR.windowMs),
    daily: new DailyBudget(getEnv().AI_SEARCH_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT),
    cache: new TtlCache<CachedAnswer>(ANSWER_TTL_MS, 500),
  })
}

/** Answer a visitor's question from the site's articles. `visitor` identifies them for rate limiting. */
export async function aiSearch(question: string | undefined, visitor: string): Promise<AiResult> {
  if (!aiSearchConfigured()) return { status: 'unavailable' }
  return runAiSearch(deps(), question, visitor)
}
