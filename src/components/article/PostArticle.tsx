import Link from 'next/link'
import { Headphones } from 'lucide-react'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { ShareButtons } from '@/components/article/ShareButtons'
import { PostImage } from '@/components/cards/PostImage'
import { PostCard } from '@/components/cards/PostCard'
import { ContentCard } from '@/components/ui/ContentCard'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { PdfLink, RichText } from '@/components/richtext/RichText'
import { YouTubeVideo } from '@/components/richtext/YouTubeVideo'
import { listPosts } from '@/features/posts/queries'
import { formatDate } from '@/lib/format'
import { categoryHref, postHref } from '@/lib/links'
import { audioSource } from '@/lib/audio'
import type { Author, Category, Media, Post } from '@/payload-types'

const asObj = <T,>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)
const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3444'

function AudioPlayer({ url }: { url: string }) {
  const source = audioSource(url)
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
      ഓഡിയോ കേൾക്കുക
    </a>
  )
}

async function RelatedPosts({ post, category }: { post: Post; category: Category | null }) {
  if (!category) return null
  const { docs } = await listPosts({ categoryId: category.id, excludeId: post.id, limit: 3 })
  if (!docs.length) return null
  return (
    <section className="mt-20">
      <SectionHeading title="Related" href={categoryHref(category.slug)} />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {docs.map((p) => (
          <li key={p.id}>
            <PostCard post={p} variant="grid" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Single article: breadcrumbs, category, title, byline + share, media (image / YouTube / audio), body, PDFs, related. */
export function PostArticle({ post, siteName }: { post: Post; siteName: string }) {
  const category = asObj<Category>(post.primaryCategory) ?? asObj<Category>(post.categories?.[0])
  const author = asObj<Author>(post.author)
  const byline = author?.name ?? siteName
  const videoUrl = post.format === 'video' ? post.video?.url : null
  const attachments = (post.attachments ?? [])
    .map((a) => ({ media: asObj<Media>(a.file), label: a.label }))
    .filter((a) => a.media)
  const url = new URL(postHref(post.postNumber) ?? '/', SITE_URL).toString()
  const date = formatDate(post.publishedAt)

  return (
    <>
      <article>
        <Breadcrumbs
          items={[
            ...(category ? [{ label: category.name, href: categoryHref(category.slug) }] : []),
            { label: post.title },
          ]}
        />
        {/* One card holds the whole article: heading, byline, media, body, downloads and sharing. */}
        <ContentCard>
          <header className="mx-auto max-w-4xl space-y-5">
            {category ? (
              <Link
                href={categoryHref(category.slug) ?? '#'}
                className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
              >
                {category.name}
              </Link>
            ) : null}
            <h1 className="text-[1.7rem] font-bold leading-[1.3] sm:text-4xl lg:text-[2.9rem]">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="max-w-3xl text-base leading-relaxed text-muted sm:text-xl">
                {post.excerpt}
              </p>
            ) : null}
            <div className="flex flex-col gap-4 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="bg-brand-gradient inline-flex size-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white shadow-card"
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

          {videoUrl ? (
            <div className="mx-auto mt-8 max-w-5xl">
              <YouTubeVideo
                url={videoUrl}
                poster={
                  post.featuredImage ? (
                    // No YouTube-thumbnail fallback here: a removed video has none.
                    <PostImage
                      post={{ ...post, video: undefined, categoryName: category?.name }}
                      size="large"
                      sizes="(min-width: 1024px) 1024px, 100vw"
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
              sizes="(min-width: 1024px) 1024px, 100vw"
              priority
              className="mx-auto mt-10 aspect-[16/9] max-w-5xl rounded-3xl shadow-card"
            />
          ) : null}

          {post.format === 'audio' && post.audio?.url ? (
            <div className="mx-auto mt-8 max-w-4xl rounded-3xl bg-surface p-5 ring-1 ring-line/60">
              <AudioPlayer url={post.audio.url} />
            </div>
          ) : null}

          <div className="mx-auto mt-8 max-w-4xl">
            <RichText data={post.content} />
          </div>

          {attachments.length ? (
            <section className="mx-auto mt-10 max-w-4xl space-y-3" aria-label="ഡൗൺലോഡുകൾ">
              {attachments.map((a, i) => (
                <PdfLink key={i} media={a.media!} label={a.label} />
              ))}
            </section>
          ) : null}

          <footer className="mx-auto mt-14 flex max-w-4xl flex-col gap-4 rounded-3xl bg-surface p-6 ring-1 ring-line/60 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-ink">
              ഈ ലേഖനം ഉപകാരപ്പെട്ടെങ്കിൽ മറ്റുള്ളവരുമായി പങ്കിടുക
            </p>
            <ShareButtons url={url} title={post.title} />
          </footer>
        </ContentCard>
      </article>
      <RelatedPosts post={post} category={category} />
    </>
  )
}
