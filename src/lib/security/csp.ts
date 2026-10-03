/**
 * Content-Security-Policy builder (used by src/proxy.ts; unit-tested in tests/unit/csp.test.ts).
 * Scripts need the per-request nonce ('strict-dynamic' lets Next's own chunks load); no host
 * allowlist for scripts at all, so no third-party script can ever run on the site or the admin.
 */
export type CspMode = { dev: boolean; prod: boolean; mediaOrigin: string }
export type CspArea = 'site' | 'admin'
/** `previewFrame`: a staff live-preview request — our own admin (same origin) may frame the page. */
export type CspOptions = { previewFrame?: boolean }

export function originOf(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export function createNonce(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

function serialize(directives: Record<string, Array<string | false>>): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter((v): v is string => Boolean(v))].join(' '))
    .join('; ')
}

export function buildCsp(
  nonce: string,
  area: CspArea,
  mode: CspMode,
  opts: CspOptions = {},
): string {
  const media = mode.mediaOrigin || false
  const common: Record<string, Array<string | false>> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", mode.dev && "'unsafe-eval'"],
    // Style attributes are emitted by React/Next/Payload SSR; nonces cannot cover attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", mode.dev && 'ws:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': [area === 'site' && opts.previewFrame ? "'self'" : "'none'"],
    'form-action': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    ...(mode.prod ? { 'upgrade-insecure-requests': [] } : {}),
  }
  if (area === 'admin') {
    return serialize({
      ...common,
      'img-src': ["'self'", 'data:', 'blob:', media],
      'media-src': ["'self'", 'blob:', media],
      'frame-src': ["'self'"],
    })
  }
  return serialize({
    ...common,
    'img-src': ["'self'", 'data:', 'blob:', media, 'https://i.ytimg.com'],
    'media-src': ["'self'", media],
    'frame-src': ['https://www.youtube-nocookie.com'],
  })
}
