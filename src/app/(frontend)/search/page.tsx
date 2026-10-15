import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { ArchiveHeader } from '@/components/listing/ArchiveHeader'
import { PostListing } from '@/components/listing/PostListing'
import { SearchForm, SEARCH_PATH } from '@/components/layout/SearchForm'
import { AiAnswer, AiAnswerSkeleton } from '@/components/search/AiAnswer'
import { aiSearchUiEnabled } from '@/features/ai-search/service'
import { searchPages, searchPosts } from '@/features/search/queries'
import { parsePage } from '@/lib/format'
import { pageHref } from '@/lib/links'
import { parseSearchQuery, SEARCH_QUERY } from '@/lib/text/search'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseSearchQuery((await searchParams).q)
  // Result pages are thin, ever-changing lists: keep them out of the index, but let crawlers follow links.
  return {
    title: query ? `തിരയൽ: ${query.display}` : 'തിരയൽ',
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const query = parseSearchQuery(params.q)
  const page = parsePage(params.page, 500)
  const aiEnabled = aiSearchUiEnabled()
  const askAi = aiEnabled && Boolean(query) && page === 1 && params.ai === '1'
  const rawQuestion = Array.isArray(params.q) ? params.q[0] : params.q
  const [posts, pages] = query
    ? await Promise.all([
        searchPosts(query.normalized, page),
        page === 1 ? searchPages(query.normalized) : Promise.resolve([]),
      ])
    : [null, []]

  return (
    <Container className="py-6 lg:py-10">
      <ArchiveHeader
        kicker="തിരയൽ"
        title={query ? `“${query.display}”` : 'ലേഖനങ്ങൾ തിരയുക'}
        crumbs={[{ label: 'തിരയൽ' }]}
        count={posts?.totalDocs ?? null}
      >
        <SearchForm
          variant="page"
          defaultValue={query?.display}
          className="max-w-2xl"
          ai={aiEnabled}
        />
      </ArchiveHeader>

      {aiEnabled && query ? (
        <nav aria-label="തിരയൽ രീതി" className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`${SEARCH_PATH}?${new URLSearchParams({ q: query.display })}`}
            aria-current={askAi ? undefined : 'page'}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 transition ${askAi ? 'bg-card text-body ring-line hover:text-brand' : 'bg-brand text-white shadow-card ring-brand'}`}
          >
            <Search className="size-4" aria-hidden="true" />
            ലേഖനങ്ങൾ
          </Link>
          <Link
            href={`${SEARCH_PATH}?${new URLSearchParams({ q: query.display, ai: '1' })}`}
            aria-current={askAi ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 transition ${askAi ? 'bg-brand text-white shadow-card ring-brand' : 'bg-card text-brand ring-brand/40 hover:bg-brand-soft'}`}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            AI ഉത്തരം
          </Link>
        </nav>
      ) : null}

      {askAi ? (
        <Suspense fallback={<AiAnswerSkeleton />}>
          <AiAnswer question={rawQuestion} />
        </Suspense>
      ) : null}

      {!query || !posts ? (
        <EmptyState
          icon={Search}
          title="എന്താണ് തിരയേണ്ടത്?"
          description={`കുറഞ്ഞത് ${SEARCH_QUERY.min} അക്ഷരങ്ങൾ ടൈപ്പ് ചെയ്യുക — ഉദാ: ഖുർആൻ, നമസ്കാരം, നബി.`}
        />
      ) : (
        <>
          {pages.length ? (
            <section aria-labelledby="page-hits" className="mb-12">
              <h2 id="page-hits" className="mb-4 text-lg font-bold">
                പേജുകൾ
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={pageHref(p.path) ?? '#'}
                      className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 font-semibold text-ink shadow-card transition-colors hover:border-brand hover:text-brand"
                    >
                      {p.title}
                      <ArrowRight
                        className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <PostListing
            list={posts}
            basePath={SEARCH_PATH}
            query={{ q: query.display }}
            emptyTitle="ഫലങ്ങളൊന്നും കണ്ടെത്തിയില്ല"
            emptyDescription="മറ്റൊരു വാക്ക് അല്ലെങ്കിൽ ചെറിയ വാക്ക് ഉപയോഗിച്ച് വീണ്ടും ശ്രമിക്കുക."
          />
        </>
      )}
    </Container>
  )
}
