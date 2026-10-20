import { BookOpen, Download } from 'lucide-react'
import { PostImage } from '@/components/cards/PostImage'
import { EbookReader } from '@/components/ebook/EbookReader'
import { formatBytes } from '@/components/richtext/RichText'
import { ebookFileHref } from '@/lib/ebook'
import type { Media, Post } from '@/payload-types'

type EbookPanelProps = {
  post: Post & { categoryName?: string }
  pdf: Media
  /** Absolute address of the post, for sharing. */
  url: string
}

/**
 * An e-book's post page: the cover (whole, over a blurred copy of itself) opens the page-turning
 * reader, with "Read the book" and "Download PDF" under it. Both use the same-origin PDF route.
 */
export function EbookPanel({ post, pdf, url }: EbookPanelProps) {
  const src = ebookFileHref(post.postNumber!)
  const downloadHref = ebookFileHref(post.postNumber!, true)
  const size = formatBytes(pdf.filesize)

  return (
    <section aria-label="E-book" className="mt-4 space-y-4">
      <EbookReader
        title={post.title}
        src={src}
        downloadHref={downloadHref}
        shareUrl={url}
        className="group relative block aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl bg-brand-deep shadow-card ring-1 ring-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <span className="absolute inset-0 scale-125 blur-2xl saturate-150" aria-hidden="true">
          <PostImage post={post} size="thumb" sizes="64px" cover className="!bg-transparent" />
        </span>
        <span className="absolute inset-0 bg-black/20" aria-hidden="true" />
        <PostImage
          post={post}
          size="large"
          sizes="(min-width: 1024px) 920px, 100vw"
          priority
          cover
          fit="contain"
          titleOnFallback
          className="!bg-transparent p-2 transition duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
        />
        <span className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-brand-deep shadow-lift ring-1 ring-black/5 transition group-hover:bg-white">
          <BookOpen className="size-5" aria-hidden="true" />
          Open the book
        </span>
      </EbookReader>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/60 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">E-Book</span>
          {size ? ` · PDF · ${size}` : ' · PDF'}
        </p>
        <div className="flex flex-wrap gap-3">
          <EbookReader title={post.title} src={src} downloadHref={downloadHref} shareUrl={url} />
          <a
            href={downloadHref}
            download
            className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-card px-6 font-semibold text-ink ring-1 ring-line transition-colors hover:text-brand hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Download className="size-5" aria-hidden="true" />
            Download PDF
          </a>
        </div>
      </div>
    </section>
  )
}
