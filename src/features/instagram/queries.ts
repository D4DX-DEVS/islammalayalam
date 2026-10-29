import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import { getEnv } from '@/lib/env'
import {
  chooseToken,
  mediaEndpoint,
  parseMedia,
  refreshEndpoint,
  type InstagramPost,
  type StoredToken,
} from '@/lib/instagram'
import { getPayloadClient } from '@/lib/payload'

/**
 * The newest picture posts of the site's Instagram account (lib/instagram.ts), for Insights. Read
 * from Instagram's API and kept for a quarter of an hour, so a post shows up on the site by itself.
 * A failed read is kept for the same quarter of an hour (so a bad token or an account with only
 * Reels never slows every page down), and meanwhile the last list that worked is shown; with none,
 * Insights fall back to the ones added in the admin.
 *
 * The token: INSTAGRAM_ACCESS_TOKEN, then the renewed one stored in the hidden
 * "instagram-connection" global (renewed weekly, well inside its 60 days). The stored one is only
 * used while it was renewed from the token that is in the environment now, so replacing the
 * variable always takes effect, and a development .env can never swap the production account.
 */
const REFRESH_SECONDS = 15 * 60
const FETCH_LIMIT = 50
const GLOBAL = 'instagram-connection' as const
let lastGood: InstagramPost[] = []

const hashOf = (token: string): string => createHash('sha256').update(token).digest('hex')

async function readConnection(): Promise<StoredToken> {
  const payload = await getPayloadClient()
  return (await payload.findGlobal({ slug: GLOBAL, depth: 0 })) as StoredToken
}

async function renew(token: string, sourceHash: string): Promise<string | null> {
  const res = await fetch(refreshEndpoint(token), { signal: AbortSignal.timeout(10_000) })
  const body = (await res.json().catch(() => ({}))) as { access_token?: unknown }
  if (!res.ok || typeof body.access_token !== 'string') return null
  const payload = await getPayloadClient()
  await payload.updateGlobal({
    slug: GLOBAL,
    data: { token: body.access_token, refreshedAt: new Date().toISOString(), sourceHash },
    depth: 0,
  })
  return body.access_token
}

/** Tokens to try, best first: the stored renewed one (if it belongs to this env token), then the env one. */
async function candidateTokens(envToken: string): Promise<string[]> {
  const sourceHash = hashOf(envToken)
  let stored: StoredToken = {}
  try {
    stored = await readConnection()
  } catch (err) {
    console.warn('[instagram] could not read the stored token', (err as Error).message)
  }
  const choice = chooseToken(stored, envToken, sourceHash)
  const tokens = [choice.token, choice.fallback].filter((t): t is string => Boolean(t))
  if (choice.renew) {
    try {
      const renewed = await renew(choice.token, sourceHash)
      if (renewed) return [renewed, envToken]
    } catch (err) {
      // The current token keeps working until it expires; renewal is tried again next time.
      console.warn('[instagram] could not renew the token', (err as Error).message)
    }
  }
  return tokens
}

async function readMedia(token: string): Promise<InstagramPost[] | null> {
  const res = await fetch(mediaEndpoint(token, FETCH_LIMIT), {
    signal: AbortSignal.timeout(10_000),
  })
  // Instagram's error text can echo the request; only the status is logged.
  if (!res.ok) {
    console.warn('[instagram] media request answered', res.status)
    return null
  }
  return parseMedia(await res.json())
}

/**
 * Cached for a quarter of an hour either way; `null` means Instagram could not be read. Keyed by
 * the token's hash (never the token itself), so a new token starts a fresh cache.
 */
const loadCached = unstable_cache(
  async (_envTokenHash: string): Promise<InstagramPost[] | null> => {
    const envToken = getEnv().INSTAGRAM_ACCESS_TOKEN
    if (!envToken) return null
    try {
      for (const token of await candidateTokens(envToken)) {
        const posts = await readMedia(token)
        if (posts) return posts
      }
    } catch (err) {
      console.warn('[instagram] could not refresh', (err as Error).message)
    }
    return null
  },
  ['instagram:media:v2'],
  { revalidate: REFRESH_SECONDS, tags: ['instagram'] },
)

/** The account's newest picture posts, newest first; `[]` when there is no working token. */
export async function getInstagramPosts(): Promise<InstagramPost[]> {
  const envToken = getEnv().INSTAGRAM_ACCESS_TOKEN
  if (!envToken) return []
  const posts = await loadCached(hashOf(envToken))
  if (posts?.length) lastGood = posts
  return posts?.length ? posts : lastGood
}
