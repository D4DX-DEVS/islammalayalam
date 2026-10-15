import { BadgeCheck, BookOpen, FilePenLine, PackageOpen, ScrollText } from 'lucide-react'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { PostalRequestForm } from '@/components/postal/PostalRequestForm'
import { RichText } from '@/components/richtext/RichText'
import { ContentCard } from '@/components/ui/ContentCard'
import { hasBlocks, plainText } from '@/lib/text/lexical'
import type { Page } from '@/payload-types'

const STEPS = [
  { icon: FilePenLine, label: 'ഫോറം പൂരിപ്പിക്കുക' },
  { icon: BadgeCheck, label: 'അംഗത്വം' },
  { icon: PackageOpen, label: 'പുസ്തകങ്ങൾ തപാലിൽ' },
] as const

/**
 * The postal-library page (template "Postal library request form"): a hero from the page title and
 * intro, the page body as an introduction, the membership form, and the page's sections as the
 * conditions beside it. All wording stays editable in the admin; only the form itself is fixed.
 */
export function PostalLibraryPage({ page }: { page: Page }) {
  const lead = plainText(page.intro?.root as never).trim()
  const conditions = (page.sections ?? []).filter((s) => s.title)

  return (
    <article>
      <Breadcrumbs items={[{ label: page.title }]} />

      <header className="bg-night relative isolate overflow-hidden rounded-panel px-6 py-10 text-white shadow-lift sm:px-12 sm:py-14">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-white/15">
          <BookOpen className="size-4 text-accent" aria-hidden="true" />
          Postal Library
        </p>
        <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-[1.3] sm:text-5xl">
          {page.title}
        </h1>
        {lead ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {lead}
          </p>
        ) : null}
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, label }, i) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-white/15"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold leading-snug">
                <span className="block text-xs font-medium text-white/70">Step {i + 1}</span>
                {label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
        <div className="min-w-0 space-y-8">
          {hasBlocks(page.content) ? (
            <ContentCard className="sm:p-8 lg:p-10">
              <RichText data={page.content} />
            </ContentCard>
          ) : null}

          <section
            id="apply"
            aria-labelledby="postal-form-title"
            className="scroll-mt-24 rounded-panel bg-card p-5 shadow-card ring-1 ring-line/70 sm:p-8 lg:p-10"
          >
            <h2 id="postal-form-title" className="text-2xl font-bold text-title sm:text-[1.7rem]">
              അംഗത്വ അപേക്ഷ
            </h2>
            <PostalRequestForm />
          </section>
        </div>

        {conditions.length ? (
          <aside className="space-y-6 lg:sticky lg:top-24">
            {conditions.map((section, i) => (
              <section
                key={section.id ?? i}
                className="rounded-panel bg-surface p-5 ring-1 ring-line/70 sm:p-6"
              >
                <h2 className="flex items-center gap-2.5 text-lg font-bold leading-snug text-title">
                  <ScrollText className="size-5 shrink-0 text-brand" aria-hidden="true" />
                  {section.title}
                </h2>
                <RichText data={section.content} className="prose-ml mt-4" />
              </section>
            ))}
          </aside>
        ) : null}
      </div>
    </article>
  )
}
