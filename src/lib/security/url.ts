/**
 * URL allowlisting for anything stored in content (links, embeds) or rendered as an href.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
// Control characters and whitespace that browsers ignore inside a scheme (e.g. "java\tscript:")
const CONTROL = /[\u0000-\u001F\u007F-\u009F\s]+/g

/** True for relative site paths, fragments, and http(s)/mailto/tel URLs. */
export function isSafeHref(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const value = input.trim()
  if (!value) return false
  if (value.startsWith('#')) return true
  // Browsers drop tabs/newlines inside URLs ("/\t/x.invalid" is really "//x.invalid"), so the
  // compacted form is checked for protocol-relative (off-site) paths too.
  const compact = value.replace(CONTROL, '')
  if (value.startsWith('/')) return !/^\/[/\\]/.test(compact) && !/^\/[/\\]/.test(value)
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]
  if (!scheme) return false // bare relative paths like "foo/bar" are not used by this site
  return ALLOWED_SCHEMES.has(`${scheme.toLowerCase()}:`)
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** Extract an 11-char YouTube video id from any common YouTube URL form; null if not YouTube. */
export function youtubeId(input: string): string | null {
  const value = input.trim()
  if (YOUTUBE_ID.test(value)) return value
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else id = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}
