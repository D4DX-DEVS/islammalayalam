import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Breadcrumbs, type Crumb } from '@/components/article/Breadcrumbs'
import { ContactDetails, emailsOf } from '@/components/layout/ContactDetails'
import { RichText } from '@/components/richtext/RichText'
import { SectionTabs } from '@/components/page/SectionTabs'
import { ContentCard } from '@/components/ui/ContentCard'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getChildPages, getPageByPath, type PageLink } from '@/features/pages/queries'
import { getSiteSettings } from '@/features/site/queries'
import { pageHref } from '@/lib/links'
import { hasBlocks, withoutLeadingTitle } from '@/lib/text/lexical'
import type { Page, SiteSetting } from '@/payload-types'

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
    <nav aria-label={title} className="rounded-panel bg-surface p-3">
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

/** Where to find us: the contact details from Site settings, as a card for the side column. */
function ContactCard({ contact }: { contact: SiteSetting['contact'] }) {
  if (!contact?.address && !contact?.phone && !emailsOf(contact).length) return null
  return (
    <section
      aria-label="Contact details"
      className="rounded-panel bg-card p-5 shadow-card ring-1 ring-line/60"
    >
      <SectionHeading title="Contact Us" icon={Mail} className="!mb-4 sm:!mb-4" />
      <ContactDetails contact={contact} labels />
    </section>
  )
}

/**
 * Knowledge-base / static page: intro, body, tabbed sections, and a column on the right with the
 * sub-page navigation and, on a static page (About Us …), the contact details. A page with neither
 * uses the full width.
 */
export async function KbPage({ page }: { page: Page }) {
  const parentId =
    page.parent && typeof page.parent === 'object'
      ? page.parent.id
      : typeof page.parent === 'string'
        ? page.parent
        : null
  const showContact = page.kind === 'static'
  const [crumbs, children, siblings, settings] = await Promise.all([
    ancestorCrumbs(page),
    getChildPages(page.id),
    parentId ? getChildPages(parentId) : Promise.resolve([]),
    showContact ? getSiteSettings() : Promise.resolve(null),
  ])
  const sections = (page.sections ?? []).filter((s) => s.title)
  // The title above is the page's only title: a body that opens with the same heading drops it.
  const body = withoutLeadingTitle(page.content, page.title)
  const nav = children.length
    ? { title: 'In this section', pages: children }
    : { title: 'Related pages', pages: siblings }
  const contact = settings?.contact
  const hasAside = nav.pages.length > 0 || Boolean(contact)

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div
        className={`grid grid-cols-1 gap-5 ${hasAside ? 'lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}
      >
        <article className="min-w-0">
          {/* Heading, intro and body in one card; tab panels below are cards of their own. */}
          <ContentCard>
            <h1 className="text-2xl font-bold leading-snug sm:text-[1.75rem] lg:text-[2rem] lg:leading-[1.35]">
              {page.title}
            </h1>
            <span
              className="mb-5 mt-3 block h-1 w-12 rounded-full bg-gradient-to-r from-brand-glow to-accent"
              aria-hidden="true"
            />
            {page.intro ? (
              <RichText
                data={page.intro}
                className="prose-ml rounded-card border-s-4 border-brand bg-brand-soft/50 px-5 py-4 !text-body"
              />
            ) : null}
            {hasBlocks(body) ? (
              <div className={page.intro ? 'mt-5' : ''}>
                <RichText
                  data={body}
                  className="prose-ml text-base leading-[1.75] sm:text-[1.0625rem] sm:leading-[1.8]"
                />
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
        {hasAside ? (
          <aside className="space-y-4 lg:sticky lg:top-20">
            <SubPages title={nav.title} pages={nav.pages} currentId={page.id} />
            {contact ? <ContactCard contact={contact} /> : null}
          </aside>
        ) : null}
      </div>
    </>
  )
}
