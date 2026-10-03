import Link from 'next/link'
import { listCategories } from '@/features/categories/queries'
import { categoryHref } from '@/lib/links'

/** Topic shortcuts under the masthead: every visible category on one line, swipeable when it overflows. */
export async function TopicChips() {
  const categories = await listCategories()
  if (!categories.length) return null
  return (
    <nav aria-label="വിഷയങ്ങൾ" className="-mx-4 sm:mx-0">
      <ul className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 sm:px-0">
        <li className="flex shrink-0 items-center pe-1 text-sm font-bold text-ink">വിഷയങ്ങൾ</li>
        {categories.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link
              href={categoryHref(c.slug) ?? '#'}
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-line bg-card px-4 text-sm font-medium text-body transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
