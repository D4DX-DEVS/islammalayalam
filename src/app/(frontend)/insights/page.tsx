import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuotePoster } from '@/components/quotes/QuotePoster'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { getQuotesPage } from '@/features/quotes/queries'
import { getSiteSettings } from '@/features/site/queries'
import { formatDate, parsePage } from '@/lib/format'

const PAGE_SIZE = 12
const BASE = '/insights/'
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = parsePage((await searchParams).page)
  return {
    title: page > 1 ? `Insights — പേജ് ${page}` : 'Insights',
    description: 'Insights from Islam Malayalam: posters and thoughts to read and share.',
    alternates: { canonical: page > 1 ? `${BASE}?page=${page}` : BASE },
  }
}

/** Every insight, newest first, 12 to a page. Each poster opens its own page, with sharing. */
export default async function InsightsPage({ searchParams }: Props) {
  const requested = parsePage((await searchParams).page)
  const [list, settings] = await Promise.all([
    getQuotesPage(requested, PAGE_SIZE),
    getSiteSettings(),
  ])
  if (requested > 1 && requested > list.totalPages) notFound()
  return (
    <Container className="py-6 lg:py-10">
      <h1 className="sr-only">Insights</h1>
      {list.docs.length ? (
        <>
          {list.totalPages > 1 ? (
            <p className="mb-6 text-sm font-medium text-muted">
              പേജ് {list.page} / {list.totalPages}
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {list.docs.map((quote, i) => {
              const date = formatDate(quote.date)
              return (
                <li key={quote.id}>
                  <Link
                    href={quote.href}
                    className="group block rounded-2xl outline-offset-4 transition focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl shadow-card ring-1 ring-line/60 transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-lift motion-reduce:transform-none">
                      <QuotePoster
                        quote={quote}
                        siteName={settings.siteName}
                        frame
                        priority={i < 4}
                        sizes="(min-width: 1280px) 20rem, (min-width: 1024px) 26rem, (min-width: 640px) 45vw, 100vw"
                      />
                    </span>
                    {date || quote.source ? (
                      <span className="mt-3 block space-y-0.5 px-0.5 text-sm">
                        {quote.source ? (
                          <span className="block truncate font-semibold text-ink transition-colors group-hover:text-brand">
                            {quote.source}
                          </span>
                        ) : null}
                        {date ? (
                          <time
                            className="block text-xs text-muted"
                            dateTime={quote.date ?? undefined}
                            lang="en"
                          >
                            {date}
                          </time>
                        ) : null}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
          <Pagination basePath={BASE} page={list.page} totalPages={list.totalPages} />
        </>
      ) : (
        <EmptyState
          title="No insights yet"
          description="Check back soon."
          action={{ href: '/', label: 'ഹോം പേജിലേക്ക്' }}
        />
      )}
    </Container>
  )
}
