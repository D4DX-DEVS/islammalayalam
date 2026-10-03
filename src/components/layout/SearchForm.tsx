import { Search } from 'lucide-react'

export const SEARCH_PATH = '/search/'
export const SEARCH_MAX_LENGTH = 80

interface SearchFormProps {
  variant?: 'header' | 'page'
  defaultValue?: string
  className?: string
}

/** Plain GET form → /search/?q=… (works without JavaScript, shareable URLs). */
export function SearchForm({ variant = 'header', defaultValue, className = '' }: SearchFormProps) {
  const page = variant === 'page'
  return (
    <form
      action={SEARCH_PATH}
      method="get"
      role="search"
      className={`flex items-center gap-2 ${className}`}
    >
      <label className="relative flex min-w-0 flex-1 items-center">
        <span className="sr-only">തിരയുക</span>
        <Search
          className={`pointer-events-none absolute start-4 text-muted ${page ? 'size-5' : 'size-4'}`}
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="ലേഖനങ്ങൾ തിരയുക…"
          enterKeyHint="search"
          className={`w-full rounded-full border border-line bg-surface text-ink placeholder:text-muted transition focus:border-brand focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/15 ${page ? 'h-14 ps-12 pe-5 text-base sm:text-lg' : 'h-10 ps-10 pe-4 text-sm'}`}
        />
      </label>
      {page ? (
        <button
          type="submit"
          className="inline-flex h-14 shrink-0 items-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          തിരയുക
        </button>
      ) : null}
    </form>
  )
}
