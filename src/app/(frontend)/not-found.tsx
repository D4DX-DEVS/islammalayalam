import { ArrowRight, House } from 'lucide-react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { SearchForm } from '@/components/layout/SearchForm'

export default function NotFound() {
  return (
    <Container className="py-12 lg:py-20">
      <div className="relative isolate mx-auto max-w-2xl overflow-hidden rounded-[1.75rem] bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
        <div
          className="mask-star-lattice pointer-events-none absolute inset-0 -z-10 bg-brand opacity-[0.06]"
          aria-hidden="true"
        />
        <p className="font-display text-6xl font-bold text-brand sm:text-7xl">404</p>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">ഈ പേജ് കണ്ടെത്താനായില്ല</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The page you are looking for does not exist or has moved. തിരഞ്ഞു നോക്കൂ:
        </p>
        <SearchForm variant="page" className="mx-auto mt-8 max-w-lg" />
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand hover:text-brand-strong"
        >
          <House className="size-4" aria-hidden="true" />
          ഹോം പേജിലേക്ക്
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </Container>
  )
}
