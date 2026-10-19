import { SITE_URL } from '@/lib/site-url'

/** Absolute address for sharing: link previews and share targets need the full URL. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).toString()
