'use server'

import { headers } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { DailyBudget, RateLimiter } from '@/lib/security/rate-limit'
import { FIELD_NAMES, parsePostalRequest, type FieldErrors } from './schema'

/**
 * Receives the postal-library membership form. Order matters: the hidden "website" field catches
 * simple bots (they are told "thanks" and nothing is stored), then per-visitor and site-wide limits,
 * then validation, and only then the write, through the Local API (the collection has no public
 * create access). The audit log records the actor as "postal-form".
 */
export type PostalFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message?: string; errors: FieldErrors; values: Record<string, string> }

const perVisitor = new RateLimiter(5, 60 * 60 * 1000) // 5 requests an hour from one address
const perDay = new DailyBudget(300) // and 300 a day for the whole site

const MESSAGE = {
  busy: 'ഇപ്പോൾ ഒരുപാട് അപേക്ഷകൾ ലഭിച്ചു. അൽപ്പസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.',
  failed: 'അപേക്ഷ സമർപ്പിക്കാനായില്ല. ഒരിക്കൽക്കൂടി ശ്രമിക്കുക.',
  invalid: 'ചില വിവരങ്ങൾ ശരിയല്ല. ചുവന്ന അടയാളമുള്ളവ പരിശോധിക്കുക.',
} as const

export async function submitPostalRequest(
  _previous: PostalFormState,
  formData: FormData,
): Promise<PostalFormState> {
  // A real visitor never sees this field; a bot that fills every input does.
  if (String(formData.get('website') ?? '').trim()) return { status: 'success' }

  const values: Record<string, string> = {}
  for (const name of FIELD_NAMES) {
    const value = formData.get(name)
    values[name] = typeof value === 'string' ? value : ''
  }

  const h = await headers()
  const visitor = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  if (!perVisitor.take(visitor) || !perDay.take())
    return { status: 'error', message: MESSAGE.busy, errors: {}, values }

  const parsed = parsePostalRequest(values)
  if (!parsed.ok)
    return { status: 'error', message: MESSAGE.invalid, errors: parsed.errors, values }

  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'postal-requests',
      data: { ...parsed.data, status: 'new' },
      overrideAccess: true,
      context: { actor: 'postal-form' },
    })
  } catch (err) {
    // Never echo the cause: it can name collections, fields or the content guard's rules.
    console.error('postal request could not be saved', (err as Error).message)
    return { status: 'error', message: MESSAGE.failed, errors: {}, values }
  }
  return { status: 'success' }
}
