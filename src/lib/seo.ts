/**
 * Search-engine and AI-answer metadata: meta descriptions and schema.org JSON-LD. Pure, so they
 * are unit-tested; the pages pass in what they already loaded.
 */
import { SITE_URL } from '@/lib/site-url'
import { plainText } from '@/lib/text/lexical'

type JsonLd = Record<string, unknown>

/** Longest meta description search results show before cutting it off. */
export const DESCRIPTION_LENGTH = 160

/** One line of plain text, cut at a word boundary to `max` characters (with an ellipsis). */
export function describe(
  text: string | null | undefined,
  max = DESCRIPTION_LENGTH,
): string | undefined {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?—–-]+$/, '')}…`
}

/**
 * A post's meta description: the editor's SEO text, else the excerpt, else the start of the body
 * (most imported posts have neither of the first two).
 */
export function postDescription(post: {
  meta?: { description?: string | null } | null
  excerpt?: string | null
  content?: unknown
}): string | undefined {
  // Blocks (paragraphs, headings) are joined with a space so their sentences don't run together.
  const blocks = (
    post.content as { root?: { children?: Parameters<typeof plainText>[0][] } } | null
  )?.root?.children
  return (
    describe(post.meta?.description) ??
    describe(post.excerpt) ??
    describe((blocks ?? []).map(plainText).join(' '))
  )
}

/** A site path (or an https address) as a full address on the site. */
export const absolute = (pathOrUrl: string, base: string = SITE_URL): string =>
  new URL(pathOrUrl, base).toString()

/**
 * The JSON for a `<script type="application/ld+json">`. `<` is escaped so text from the CMS can
 * never close the script tag (Next.js JSON-LD guide).
 */
export const jsonLdHtml = (data: JsonLd | JsonLd[]): string =>
  JSON.stringify(data).replace(/</g, '\\u003c')

const ORG_ID = (base: string) => `${base}/#organization`
const SITE_ID = (base: string) => `${base}/#website`

export interface SiteInfo {
  name: string
  alternateName?: string | null
  description?: string | null
  /** Full address of the logo. */
  logo?: string | null
  /** Profiles elsewhere (Facebook, YouTube…): `sameAs`. */
  profiles?: (string | null | undefined)[]
  email?: string | null
}

/** The publisher and the site itself, with the site search — on every page, once. */
export function siteJsonLd(site: SiteInfo, base: string = SITE_URL): JsonLd {
  const sameAs = (site.profiles ?? []).filter((u): u is string => !!u && /^https:\/\//.test(u))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID(base),
        name: site.name,
        ...(site.alternateName ? { alternateName: site.alternateName } : {}),
        url: `${base}/`,
        ...(site.logo ? { logo: { '@type': 'ImageObject', url: site.logo } } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(site.email ? { email: site.email } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID(base),
        name: site.name,
        ...(site.alternateName ? { alternateName: site.alternateName } : {}),
        ...(site.description ? { description: site.description } : {}),
        url: `${base}/`,
        inLanguage: 'ml',
        publisher: { '@id': ORG_ID(base) },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${base}/search/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

export interface ArticleInfo {
  /** Site path of the article (/1234/). */
  path: string
  title: string
  description?: string | null
  /** Full addresses of the article's pictures. */
  images?: string[]
  publishedAt?: string | null
  updatedAt?: string | null
  author?: { name: string; path?: string | null } | null
  section?: string | null
}

/** One article: what it is, who wrote it, when, and for which publisher (Google Article, AI citations). */
export function articleJsonLd(a: ArticleInfo, base: string = SITE_URL): JsonLd {
  const url = absolute(a.path, base)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: a.title.length > 110 ? `${a.title.slice(0, 109)}…` : a.title,
    name: a.title,
    ...(a.description ? { description: a.description } : {}),
    ...(a.images?.length ? { image: a.images } : {}),
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
    ...(a.updatedAt || a.publishedAt ? { dateModified: a.updatedAt || a.publishedAt } : {}),
    author: a.author
      ? {
          '@type': 'Person',
          name: a.author.name,
          ...(a.author.path ? { url: absolute(a.author.path, base) } : {}),
        }
      : { '@id': ORG_ID(base) },
    publisher: { '@id': ORG_ID(base) },
    isPartOf: { '@id': SITE_ID(base) },
    inLanguage: 'ml',
    ...(a.section ? { articleSection: a.section } : {}),
  }
}

/** Home › … › current, as Google shows it under the result. Crumbs without a path are skipped, except the last. */
export function breadcrumbJsonLd(
  items: { name: string; path?: string | null }[],
  base: string = SITE_URL,
): JsonLd {
  const all = [{ name: 'Home', path: '/' }, ...items]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all
      .filter((c, i) => c.path || i === all.length - 1)
      .map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        ...(c.path ? { item: absolute(c.path, base) } : {}),
      })),
  }
}
