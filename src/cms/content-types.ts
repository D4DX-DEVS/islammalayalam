/**
 * The kinds of content the site publishes, in one place: the admin sidebar, the dashboard and the
 * Posts config all read this list, so a kind is named (and ordered) once. Every kind is stored in
 * the `posts` collection with `format` set to its key; the public URL (/<number>/) is the same for
 * all of them, so nothing about storage or links depends on this file.
 */
export type ContentFormat = 'standard' | 'video' | 'audio' | 'ebook'

export interface ContentType {
  key: ContentFormat
  singular: string
  plural: string
  /** One line for pickers and empty states. */
  description: string
}

export const CONTENT_TYPES: readonly ContentType[] = [
  {
    key: 'standard',
    singular: 'Article',
    plural: 'Articles',
    description: 'Written pieces: articles, questions and answers, news',
  },
  { key: 'video', singular: 'Video', plural: 'Videos', description: 'A YouTube video with notes' },
  {
    key: 'audio',
    singular: 'Audio',
    plural: 'Audio',
    description: 'A Spotify episode or a hosted audio file',
  },
  {
    key: 'ebook',
    singular: 'E-book',
    plural: 'E-books',
    description: 'A PDF read as a page-turning book on the site',
  },
]

export const CONTENT_FORMATS = CONTENT_TYPES.map((t) => t.key) as readonly ContentFormat[]

/** The kind for a stored `format` value; anything unknown (or missing) counts as an article. */
export function contentType(key: string | null | undefined): ContentType {
  return CONTENT_TYPES.find((t) => t.key === key) ?? CONTENT_TYPES[0]!
}

export const isContentFormat = (value: unknown): value is ContentFormat =>
  typeof value === 'string' && CONTENT_FORMATS.includes(value as ContentFormat)

/** Admin path (under the admin route) of the list of one kind: the Posts list filtered by format. */
export const contentListPath = (key: ContentFormat): string =>
  `/collections/posts?where[format][equals]=${key}`
