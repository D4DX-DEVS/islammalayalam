/**
 * /llms.txt (llmstxt.org): a short Markdown map of the site for AI assistants and answer engines —
 * what the site is, its sections and its newest articles, each with its full address. Pure, so it
 * is unit-tested; the route passes in what it loaded.
 */
import { categoryHref, postHref } from '@/lib/links'
import { absolute } from '@/lib/seo'

export interface LlmsSources {
  name: string
  alternateName?: string | null
  tagline?: string | null
  categories: { name?: string | null; slug?: string | null }[]
  posts: { title?: string | null; postNumber?: number | null }[]
}

/** One line of Markdown link text: no brackets or line breaks from the CMS. */
const label = (text: string): string =>
  text
    .replace(/[[\]\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function llmsTxt(src: LlmsSources, base?: string): string {
  const title = src.alternateName ? `${src.name} (${src.alternateName})` : src.name
  const link = (text: string, path: string) => `- [${label(text)}](${absolute(path, base)})`
  const sections = src.categories.flatMap((c) => {
    const href = categoryHref(c.slug)
    return c.name && href ? [link(c.name, href)] : []
  })
  const posts = src.posts.flatMap((p) => {
    const href = postHref(p.postNumber)
    return p.title && href ? [link(p.title, href)] : []
  })
  return [
    `# ${label(title)}`,
    '',
    ...(src.tagline ? [`> ${label(src.tagline)}`, ''] : []),
    'A Malayalam-language website about Islam: articles, questions and answers, videos, audio talks and e-books. Content is in Malayalam (ml).',
    '',
    ...(sections.length ? ['## Sections', '', ...sections, ''] : []),
    ...(posts.length ? ['## Latest articles', '', ...posts, ''] : []),
    '## Optional',
    '',
    link('Sitemap (every article and page)', '/sitemap.xml'),
    link('Search', '/search/'),
    '',
  ].join('\n')
}
