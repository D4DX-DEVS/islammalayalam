const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3444'

/** Absolute address for sharing: link previews and share targets need the full URL. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).toString()
