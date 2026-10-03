/**
 * Live preview addressing (pure; shared by payload.config.ts, the preview route and tests).
 *
 * A preview link names a DOCUMENT (collection + id, or a global), never a URL: the preview route
 * looks the document up as the signed-in user and redirects to that document's own public path, so
 * the route can never be used as an open redirect.
 */
export const PREVIEW_ROUTE = '/next/preview/'
export const EXIT_PREVIEW_ROUTE = '/next/exit-preview/'
/** Set by Next's draftMode().enable(); its value is a per-build secret, so it cannot be forged. */
export const PREVIEW_COOKIE = '__prerender_bypass'

export const PREVIEW_COLLECTIONS = ['posts', 'pages'] as const
export const PREVIEW_GLOBALS = ['homepage'] as const
export type PreviewCollection = (typeof PREVIEW_COLLECTIONS)[number]
export type PreviewGlobal = (typeof PREVIEW_GLOBALS)[number]
export type PreviewTarget =
  | { kind: 'collection'; collection: PreviewCollection; id: string }
  | { kind: 'global'; global: PreviewGlobal }

const OBJECT_ID = /^[a-f0-9]{24}$/
const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

/** What the admin is editing → preview target (null for anything that has no public page). */
export function previewTargetFor(args: {
  collection?: string
  global?: string
  id?: unknown
}): PreviewTarget | null {
  if (args.global)
    return isOneOf(PREVIEW_GLOBALS, args.global) ? { kind: 'global', global: args.global } : null
  const id =
    typeof args.id === 'string' ? args.id : typeof args.id === 'number' ? String(args.id) : ''
  if (!isOneOf(PREVIEW_COLLECTIONS, args.collection) || !OBJECT_ID.test(id)) return null
  return { kind: 'collection', collection: args.collection, id }
}

/** Absolute URL (the admin posts messages to its origin, so it must be absolute). */
export function previewUrl(serverURL: string, target: PreviewTarget): string {
  const params = new URLSearchParams(
    target.kind === 'global'
      ? { global: target.global }
      : { collection: target.collection, id: target.id },
  )
  return `${serverURL.replace(/\/$/, '')}${PREVIEW_ROUTE}?${params.toString()}`
}

/** Query string of the preview route → target (strict: unknown values are rejected). */
export function parsePreviewTarget(params: URLSearchParams): PreviewTarget | null {
  const global = params.get('global')
  if (global !== null) return previewTargetFor({ global })
  return previewTargetFor({ collection: params.get('collection') ?? '', id: params.get('id') })
}

/**
 * A same-site path to return to after leaving preview. Anything that is not a plain local path
 * (scheme, `//host`, backslashes, control characters, over-long) falls back to the home page.
 * Returns the percent-encoded pathname only (no query), ready for a Location header. The check runs
 * again AFTER parsing: dot-segments collapse (`/.//attacker.invalid` → `//attacker.invalid`), and a result
 * starting with `//` would be a protocol-relative URL to another host.
 */
export function safeLocalPath(raw: string | null | undefined): string {
  if (!raw || raw.length > 512 || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return '/'
  try {
    const base = 'http://local.invalid'
    const url = new URL(raw, base)
    if (url.origin !== base || url.pathname.startsWith('//')) return '/'
    return url.pathname
  } catch {
    return '/'
  }
}
