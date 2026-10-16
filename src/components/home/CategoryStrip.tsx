import Link from 'next/link'
import { listCategories } from '@/features/categories/queries'
import { categoryIcon } from '@/lib/category-icons'
import { categoryHref } from '@/lib/links'

/**
 * Category shortcuts under the hero: one round icon tile per visible category, evenly spread on
 * desktop and swipeable on phones. The tiles pop in one after another as the strip scrolls into view.
 */
export async function CategoryStrip() {
  const categories = (await listCategories()).filter((c) => c.showInStrip !== false)
  if (!categories.length) return null
  return (
    <nav
      aria-label="വിഷയങ്ങൾ"
      className="rounded-2xl bg-card p-2 shadow-card ring-1 ring-line/60 sm:p-3"
    >
      <ul className="no-scrollbar flex snap-x gap-1 overflow-x-auto">
        {categories.map((c) => {
          const Icon = categoryIcon(c)
          return (
            <li
              key={c.id}
              data-reveal="zoom"
              suppressHydrationWarning
              className="min-w-[6.5rem] flex-1 snap-start"
            >
              <Link
                href={categoryHref(c.slug) ?? '#'}
                className="group flex h-full flex-col items-center gap-2.5 rounded-xl px-1 py-3 text-center"
              >
                <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/10 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:bg-brand group-hover:text-white group-hover:shadow-lift group-focus-visible:-translate-y-1 group-focus-visible:bg-brand group-focus-visible:text-white">
                  <Icon
                    className="size-6 transition-transform duration-300 group-hover:scale-110"
                    aria-hidden="true"
                  />
                </span>
                <span className="line-clamp-2 text-[0.8rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand sm:text-[0.82rem]">
                  {c.name}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
