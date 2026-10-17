import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { QuotePoster } from '@/components/quotes/QuotePoster'
import { QuoteShare } from '@/components/quotes/QuoteShare'
import { Container } from '@/components/ui/Container'
import { getQuoteById } from '@/features/quotes/queries'
import { getSiteSettings } from '@/features/site/queries'
import { absoluteUrl } from '@/lib/absolute-url'
import { formatDate } from '@/lib/format'

type Props = { params: Promise<{ id: string }> }

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quote = await getQuoteById((await params).id)
  if (!quote) return { title: 'Insights' }
  const title = quote.text ? clip(quote.text.replace(/\s+/g, ' '), 70) : 'Insights'
  const description = quote.text
    ? clip([quote.text, quote.source && `— ${quote.source}`].filter(Boolean).join(' '), 200)
    : 'Insights — Islam Malayalam'
  return {
    title,
    description,
    alternates: { canonical: quote.href },
    openGraph: {
      type: 'article',
      title,
      description,
      images: quote.poster
        ? [{ url: quote.poster.src, width: quote.poster.width, height: quote.poster.height }]
        : undefined,
    },
    twitter: { card: quote.poster ? 'summary_large_image' : 'summary' },
  }
}

/** A single quote on its own page: the permalink that share links (and their previews) point to. */
export default async function QuotePage({ params }: Props) {
  const [quote, settings] = await Promise.all([getQuoteById((await params).id), getSiteSettings()])
  if (!quote) notFound()
  const shareText = [quote.text, quote.source ? `— ${quote.source}` : ''].filter(Boolean).join(' ')
  const date = formatDate(quote.date)

  return (
    <Container className="py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Insights', href: '/insights/' }, { label: 'Insight' }]} />
      <article className="mx-auto max-w-2xl rounded-panel bg-card p-5 shadow-card ring-1 ring-line/70 sm:p-8">
        <header className="mb-6 space-y-1">
          <h1 className="text-2xl font-normal text-title sm:text-3xl">Insights</h1>
          {date ? (
            <p className="text-sm text-muted">
              <time dateTime={quote.date ?? undefined} lang="en">
                {date}
              </time>
            </p>
          ) : null}
        </header>
        <QuotePoster
          quote={quote}
          siteName={settings.siteName}
          large
          priority
          sizes="(min-width: 768px) 42rem, 100vw"
        />
        {quote.poster && quote.text ? (
          <figure className="mt-6">
            <blockquote className="whitespace-pre-line text-lg leading-relaxed text-ink">
              {quote.text}
            </blockquote>
            {quote.source ? (
              <figcaption className="mt-2 text-sm font-medium text-muted">
                — {quote.source}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <QuoteShare
          className="mt-6 border-t border-line pt-5"
          url={absoluteUrl(quote.href)}
          text={shareText}
          posterSrc={quote.poster?.src}
        />
      </article>
      <p className="mt-6 text-center">
        <Link
          href="/insights/"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand hover:text-brand-strong"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All insights
        </Link>
      </p>
    </Container>
  )
}
