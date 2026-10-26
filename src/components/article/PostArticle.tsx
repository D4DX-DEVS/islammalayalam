import Link from 'next/link'
import { Headphones, Layers } from 'lucide-react'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { ShareButtons } from '@/components/article/ShareButtons'
import { PostImage } from '@/components/cards/PostImage'
import { PostCard } from '@/components/cards/PostCard'
import { ContentCard } from '@/components/ui/ContentCard'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { PdfLink, RichText } from '@/components/richtext/RichText'
import { EbookPanel } from '@/components/ebook/EbookPanel'
import { YouTubeVideo } from '@/components/richtext/YouTubeVideo'
import { listPosts } from '@/features/posts/queries'
import { bodyStartsWith } from '@/lib/text/lexical'
import { formatDate } from '@/lib/format'
import { categoryHref, postHref } from '@/lib/links'
import { trackAudio } from '@/lib/audio'
import { ebookPdf } from '@/lib/ebook'
import { SITE_URL } from '@/lib/site-url'
import { shareImage } from '@/lib/media'
import { absolute, articleJsonLd, breadcrumbJsonLd, postDescription } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import type { Author, Category, Media, Post } from '@/payload-types'

const asObj = <T,>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)

function AudioPlayer({ audio }: { audio: NonNullable<Post['audio']> }) {
  const { source } = trackAudio(audio)
  const url = audio.url ?? ''
  if (source.kind === 'spotify') {
    return (
      <iframe
        src={source.src}
        title="Spotify"
        loading="lazy"
        allow="encrypted-media; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups"
        className={`w-full rounded-xl border-0 ${source.tall ? 'h-[352px]' : 'h-[152px]'}`}
      />
    )
  }
  // Self-hosted/CDN audio plays inline; anything else opens on its host (CSP media-src stays strict).
  if (source.kind === 'file')
    return <audio controls preload="none" src={source.src} className="w-full" />
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-brand-gradient inline-flex min-h-12 items-center gap-2.5 rounded-full px-7 font-semibold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift"
    >
      <Headphones className="size-5" aria-hidden="true" />
      Listen to the audio
    </a>
  )
}

/** How many stories the side column lists. */
const SIDE_POSTS = 5

/**
 * The column beside the article (under it on a phone): more from the same category, topped up with
 * the newest stories when the category has few. Sticks to the screen while a long article scrolls.
 */
async function MoreStories({ post, category }: { post: Post; category: Category | null }) {
  const same = category
    ? (await listPosts({ categoryId: category.id, excludeId: post.id, limit: SIDE_POSTS })).docs
    : []
  const topUp =
    same.length < SIDE_POSTS
      ? (await listPosts({ excludeId: post.id, limit: SIDE_POSTS + same.length })).docs
      : []
  const seen = new Set(same.map((p) => p.id))
  const docs = [...same, ...topUp.filter((p) => !seen.has(p.id))].slice(0, SIDE_POSTS)
  if (!docs.length) return null
  return (
    <aside aria-label="More stories" className="lg:sticky lg:top-20">
      <SectionHeading
        title={same.length ? 'Related' : 'Latest'}
        icon={Layers}
        className="!mb-3 sm:!mb-3"
      />
      <ul className="space-y-3">
        {docs.map((p) => (
          <li key={p.id}>
            <PostCard post={p} variant="list" hideCategory />
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** Single article: breadcrumbs, category, title, byline + share, media (image / YouTube / audio / e-book reader), body, PDFs, and a column of related stories beside it. */
export function PostArticle({ post, siteName }: { post: Post; siteName: string }) {
  const category = asObj<Category>(post.primaryCategory) ?? asObj<Category>(post.categories?.[0])
  const author = asObj<Author>(post.author)
  const byline = author?.name ?? siteName
  const videoUrl = post.format === 'video' ? post.video?.url : null
  // An e-book opens in the page-turning reader; its PDF is not listed again under the downloads.
  const book = post.format === 'ebook' && post.postNumber ? ebookPdf<Media>(post) : null
  const attachments = (post.attachments ?? [])
    .map((a) => ({ media: asObj<Media>(a.file), label: a.label }))
    .filter((a) => a.media && a.media.id !== book?.id)
  const url = new URL(postHref(post.postNumber) ?? '/', SITE_URL).toString()
  const date = formatDate(post.publishedAt)

  // The excerpt of most imported posts is just the start of the body: show it only when it adds something.
  const excerpt = post.excerpt && !bodyStartsWith(post.content, post.excerpt) ? post.excerpt : null

  const hasImage = Boolean(asObj<Media>(post.featuredImage))
  const structured = [
    articleJsonLd({
      path: postHref(post.postNumber) ?? '/',
      title: post.title,
      description: postDescription(post),
      images: hasImage ? [absolute(shareImage(post.featuredImage))] : undefined,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      author: author ? { name: author.name, path: `/author/${author.slug}/` } : null,
      section: category?.name,
    }),
    breadcrumbJsonLd([
      ...(category ? [{ name: category.name, path: categoryHref(category.slug) }] : []),
      { name: post.title },
    ]),
  ]

  return (
    <>
      <JsonLd data={structured} />
      <Breadcrumbs
        items={[
          ...(category ? [{ label: category.name, href: categoryHref(category.slug) }] : []),
          { label: post.title },
        ]}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
        <article>
          {/* One card holds the whole article: heading, byline, media, body, downloads and sharing. */}
          <ContentCard>
            <header className="space-y-3">
              {category ? (
                <Link
                  href={categoryHref(category.slug) ?? '#'}
                  className="inline-flex items-center rounded-full bg-brand-soft px-3.5 py-1 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  {category.name}
                </Link>
              ) : null}
              <h1 className="text-2xl font-bold leading-snug sm:text-[1.75rem] lg:text-[2rem] lg:leading-[1.35]">
                {post.title}
              </h1>
              {excerpt ? <p className="text-base leading-relaxed text-muted">{excerpt}</p> : null}
              <div className="flex flex-col gap-3 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="bg-brand-gradient inline-flex size-10 shrink-0 items-center justify-center rounded-full font-display text-base font-bold text-white shadow-card"
                    aria-hidden="true"
                  >
                    {Array.from(byline)[0]}
                  </span>
                  <div className="text-sm leading-snug">
                    {author ? (
                      <Link
                        href={`/author/${author.slug}/`}
                        className="font-semibold text-ink hover:text-brand"
                      >
                        {author.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{byline}</span>
                    )}
                    {date ? (
                      <p className="mt-0.5 text-muted">
                        <time dateTime={post.publishedAt ?? undefined} lang="en">
                          {date}
                        </time>
                      </p>
                    ) : null}
                  </div>
                </div>
                <ShareButtons url={url} title={post.title} />
              </div>
            </header>

            {book ? (
              <EbookPanel post={{ ...post, categoryName: category?.name }} pdf={book} url={url} />
            ) : videoUrl ? (
              <div className="mt-4">
                <YouTubeVideo
                  url={videoUrl}
                  poster={
                    post.featuredImage ? (
                      // No YouTube-thumbnail fallback here: a removed video has none.
                      <PostImage
                        post={{ ...post, video: undefined, categoryName: category?.name }}
                        size="large"
                        sizes="(min-width: 1024px) 920px, 100vw"
                        cover
                      />
                    ) : null
                  }
                />
              </div>
            ) : post.featuredImage ? (
              <PostImage
                post={{ ...post, categoryName: category?.name }}
                size="large"
                sizes="(min-width: 1024px) 920px, 100vw"
                priority
                className="mt-4 aspect-[16/9] w-full rounded-2xl shadow-card"
              />
            ) : null}

            {post.format === 'audio' && (post.audio?.url || post.audio?.spotifyUrl) ? (
              <div className="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                <AudioPlayer audio={post.audio!} />
              </div>
            ) : null}

            {/* Body text: 16px / 1.75 on a phone, 17px / 1.8 from `sm` up (Malayalam letters read small at 16px). */}
            <div className="mt-5">
              <RichText
                data={post.content}
                className="prose-ml text-base leading-[1.75] sm:text-[1.0625rem] sm:leading-[1.8]"
              />
            </div>

            {attachments.length ? (
              <section className="mt-6 space-y-3" aria-label="Downloads">
                {attachments.map((a, i) => (
                  <PdfLink key={i} media={a.media!} label={a.label} />
                ))}
              </section>
            ) : null}

            <footer className="mt-6 flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/60 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-ink">
                Found this useful? Share it with others
              </p>
              <ShareButtons url={url} title={post.title} />
            </footer>
          </ContentCard>
        </article>
        <MoreStories post={post} category={category} />
      </div>
    </>
  )
}
