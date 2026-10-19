import { Search, Sparkles } from 'lucide-react'

export const SEARCH_PATH = '/search/'
export const SEARCH_MAX_LENGTH = 80
/** A question for AI search can be longer than a keyword search. */
export const AI_QUESTION_MAX_LENGTH = 200

interface SearchFormProps {
  variant?: 'header' | 'page'
  defaultValue?: string
  className?: string
  /** Offer AI search: a sparkle button that sends the same text as a question (?ai=1). */
  ai?: boolean
}

/** Plain GET form → /search/?q=… (works without JavaScript, shareable URLs). */
export function SearchForm({
  variant = 'header',
  defaultValue,
  className = '',
  ai = false,
}: SearchFormProps) {
  const page = variant === 'page'
  return (
    <form
      action={SEARCH_PATH}
      method="get"
      role="search"
      className={`relative flex items-center gap-2 ${className}`}
    >
      {/* Enter must keep meaning "search": the AI button comes after this default submit button. */}
      {ai && !page ? (
        <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only" />
      ) : null}
      <label className="relative flex min-w-0 flex-1 items-center">
        <span className="sr-only">Search</span>
        <Search
          className={`pointer-events-none absolute start-4 text-muted ${page ? 'size-5' : 'size-4'}`}
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={ai ? AI_QUESTION_MAX_LENGTH : SEARCH_MAX_LENGTH}
          placeholder="Search articles…"
          enterKeyHint="search"
          className={`w-full bg-surface text-ink ring-1 ring-line placeholder:text-muted transition focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand ${page ? 'h-14 rounded-full ps-12 pe-5 text-base shadow-card sm:text-lg' : `h-11 rounded-xl ps-10 text-sm ${ai ? 'pe-12' : 'pe-4'}`}`}
        />
      </label>
      {page ? (
        <button
          type="submit"
          className="bg-brand-gradient inline-flex h-14 shrink-0 items-center rounded-full px-7 font-semibold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift"
        >
          Search
        </button>
      ) : null}
      {ai ? (
        <button
          type="submit"
          name="ai"
          value="1"
          title="AI answer"
          aria-label="AI answer: get an answer to your question"
          className={
            page
              ? 'inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-card px-6 font-semibold text-brand shadow-card ring-1 ring-brand/40 transition hover:-translate-y-px hover:bg-brand-soft hover:shadow-lift'
              : 'bg-brand-gradient absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white shadow-card transition hover:scale-110 active:scale-95'
          }
        >
          <Sparkles className={page ? 'size-5' : 'size-4'} aria-hidden="true" />
          {page ? 'AI answer' : null}
        </button>
      ) : null}
    </form>
  )
}
