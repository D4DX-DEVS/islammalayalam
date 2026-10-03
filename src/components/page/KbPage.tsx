import Link from 'next/link'
import { Breadcrumbs, type Crumb } from '@/components/article/Breadcrumbs'
import { RichText } from '@/components/richtext/RichText'
import { SectionTabs } from '@/components/page/SectionTabs'
import { ContentCard } from '@/components/ui/ContentCard'
import { getChildPages, getPageByPath, type PageLink } from '@/features/pages/queries'
import { pageHref } from '@/lib/links'
import type { Page } from '@/payload-types'

async function ancestorCrumbs(page: Page): Promise<Crumb[]> {
  const segments = (page.path ?? '').split('/')
  const crumbs: Crumb[] = []
  for (let i = 1; i < segments.length; i++) {
    const path = segments.slice(0, i).join('/')
    const ancestor = await getPageByPath(path)
    crumbs.push({
      label: ancestor?.title ?? segments[i - 1]!,
      href: ancestor ? pageHref(path) : null,
    })
  }
  return [...crumbs, { label: page.title }]
}

function SubPages({
  title,
  pages,
  currentId,
}: {
  title: string
  pages: PageLink[]
  currentId: string
}) {
  if (!pages.length) return null
  return (
    <nav aria-label={title} className="rounded-[1.75rem] bg-surface p-3 lg:sticky lg:top-20">
      <h2 className="px-3 pb-2 pt-2 text-base font-bold">{title}</h2>
      <ul className="space-y-0.5">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              href={pageHref(p.path) ?? '#'}
              aria-current={p.id === currentId ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-card hover:text-brand ${p.id === currentId ? 'bg-card font-semibold text-brand shadow-card' : 'text-body'}`}
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Knowledge-base / static page: intro, body, tabbed sections, and sub-page navigation. */
export async function KbPage({ page }: { page: Page }) {
  const parentId =
    page.parent && typeof page.parent === 'object'
      ? page.parent.id
      : typeof page.parent === 'string'
        ? page.parent
        : null
  const [crumbs, children, siblings] = await Promise.all([
    ancestorCrumbs(page),
    getChildPages(page.id),
    parentId ? getChildPages(parentId) : Promise.resolve([]),
  ])
  const sections = (page.sections ?? []).filter((s) => s.title)
  const nav = children.length
    ? { title: 'ഈ വിഭാഗത്തിൽ', pages: children }
    : { title: 'അനുബന്ധ പേജുകൾ', pages: siblings }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <article className="min-w-0">
        <Breadcrumbs items={crumbs} />
        {/* Heading, intro and body in one card; tab panels below are cards of their own. */}
        <ContentCard>
          <h1 className="mb-5 text-[1.8rem] font-bold leading-[1.32] sm:text-4xl">{page.title}</h1>
          {page.intro ? (
            <RichText
              data={page.intro}
              className="prose-ml rounded-card border-s-4 border-brand bg-brand-soft/50 px-5 py-4 !text-body"
            />
          ) : null}
          {page.content ? (
            <div className="mt-6">
              <RichText data={page.content} />
            </div>
          ) : null}
        </ContentCard>
        {sections.length ? (
          <SectionTabs
            titles={sections.map((s) => s.title)}
            panels={sections.map((s, i) => (
              <RichText key={i} data={s.content} />
            ))}
          />
        ) : null}
      </article>
      <aside className="lg:pt-12">
        <SubPages title={nav.title} pages={nav.pages} currentId={page.id} />
      </aside>
    </div>
  )
}
