import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import type { User } from '@/payload-types'

export type Role = 'admin' | 'editor' | 'author'
/** What Payload puts on req.user after a full login: enrolled users arrive via the TOTP strategy. */
export type SessionUser = User & { collection: 'users'; hasTotp: boolean; _strategy: string }

let instance: Promise<Payload> | undefined
export const testPayload = (): Promise<Payload> => (instance ??= getPayload({ config }))

export const STRONG_PASSWORD = 'correct-horse-battery-staple-42'
let seq = 0

/** Create a staff account and return it shaped like an authenticated session user. */
export async function makeUser(
  payload: Payload,
  role: Role,
  opts: { enrolled?: boolean } = {},
): Promise<SessionUser> {
  const enrolled = opts.enrolled ?? true
  const email = `${role}-${Date.now()}-${++seq}@test.local`
  const doc = (await payload.create({
    collection: 'users',
    data: { email, password: STRONG_PASSWORD, role, name: role },
    overrideAccess: true,
  })) as User
  return {
    ...doc,
    collection: 'users',
    hasTotp: enrolled,
    _strategy: enrolled ? 'totp' : 'local-jwt',
  }
}

type Node = { type: string; version: number; [k: string]: unknown }
export const text = (t: string): Node => ({
  type: 'text',
  text: t,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
export const paragraph = (...children: Node[]): Node => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
})
export const richText = (...children: Node[]) => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})
export const linkNode = (url: string): Node => ({
  type: 'link',
  fields: { linkType: 'custom', url, newTab: false },
  children: [text('link')],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 3,
})

/** Run a Local API call and return the thrown error's HTTP status (or 'ok'). */
export async function statusOf(fn: () => Promise<unknown>): Promise<number | 'ok'> {
  try {
    await fn()
    return 'ok'
  } catch (err) {
    return (err as { status?: number }).status ?? 500
  }
}
