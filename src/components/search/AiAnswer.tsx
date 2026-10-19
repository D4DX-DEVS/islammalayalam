import { headers } from 'next/headers'
import Link from 'next/link'
import { Info, Sparkles } from 'lucide-react'
import { getEnv } from '@/lib/env'
import { aiSearch, aiSearchConfigured } from '@/features/ai-search/service'
import type { AiResult } from '@/features/ai-search/core'

/** Shell shared by every state of the AI answer card. */
function Card({
  children,
  titleId = 'ai-answer-title',
}: {
  children: React.ReactNode
  titleId?: string
}) {
  return (
    <section
      aria-labelledby={titleId}
      data-reveal="up"
      suppressHydrationWarning
      className="mb-10 overflow-hidden rounded-card bg-gradient-to-br from-brand-soft via-card to-card p-5 shadow-card ring-1 ring-brand/20 sm:p-7"
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="bg-brand-gradient inline-flex size-10 items-center justify-center rounded-xl text-white shadow-card">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id={titleId} className="text-lg font-bold leading-tight text-ink">
            AI ഉത്തരം
          </h2>
          <p className="text-xs text-muted">ഞങ്ങളുടെ ലേഖനങ്ങളിൽ നിന്ന് തയ്യാറാക്കിയത്</p>
        </div>
      </header>
      {children}
    </section>
  )
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed text-body">
    <Info className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
    <span>{children}</span>
  </p>
)

/** Shown while the answer is being written (the normal results below are already there). */
export function AiAnswerSkeleton() {
  return (
    <Card titleId="ai-answer-loading">
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">AI ഉത്തരം തയ്യാറാക്കുന്നു…</span>
        <div className="h-4 w-11/12 animate-shimmer rounded bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-line)_50%,var(--color-surface)_75%)] bg-[length:200%_100%]" />
        <div className="h-4 w-full animate-shimmer rounded bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-line)_50%,var(--color-surface)_75%)] bg-[length:200%_100%]" />
        <div className="h-4 w-4/6 animate-shimmer rounded bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-line)_50%,var(--color-surface)_75%)] bg-[length:200%_100%]" />
        <p className="pt-1 text-sm text-muted">ഉത്തരം തയ്യാറാക്കുന്നു…</p>
      </div>
    </Card>
  )
}

function Answer({ result }: { result: Extract<AiResult, { status: 'ok' }> }) {
  return (
    <Card>
      <div className="space-y-3 text-[1.02rem] leading-[1.9] text-ink">
        {result.paragraphs.map((segments, i) => (
          <p key={i}>
            {segments.map((seg, j) =>
              seg.type === 'text' ? (
                seg.text
              ) : (
                <sup key={j} className="mx-0.5">
                  <a
                    href={`#ai-source-${seg.n}`}
                    aria-label={`ഉറവിടം ${seg.n}`}
                    className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-[0.7rem] font-bold text-white no-underline transition hover:bg-brand-strong"
                  >
                    {seg.n}
                  </a>
                </sup>
              ),
            )}
          </p>
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-bold text-ink">ഉറവിടങ്ങൾ</h3>
      <ol className="grid gap-2 sm:grid-cols-2">
        {result.sources.map((s) => (
          <li key={s.n} id={`ai-source-${s.n}`} className="scroll-mt-28">
            <Link
              href={s.href}
              className="group flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-line/70 transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand/40"
            >
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                  {s.title}
                </span>
                {s.category ? <span className="text-xs text-muted">{s.category}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          ഇത് AI തയ്യാറാക്കിയ സംഗ്രഹമാണ് — മതവിധി (ഫത്വ) ആയി കണക്കാക്കരുത്. കൃത്യതയ്ക്ക് മുകളിലെ
          ലേഖനങ്ങൾ വായിക്കുക. ചോദ്യം AI സേവനത്തിലേക്ക് (Claude, Anthropic) അയയ്ക്കുന്നു.
        </span>
      </p>
    </Card>
  )
}

/** The AI answer for `question`, shown above the ordinary results. Every failure degrades to a short note. */
export async function AiAnswer({ question }: { question: string | undefined }) {
  if (!aiSearchConfigured()) {
    // Visitors never see this (the AI buttons are hidden without a key); developers get a hint.
    if (getEnv().NODE_ENV !== 'development') return null
    return (
      <Card>
        <Note>
          AI search is switched off. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> and
          restart the server to turn it on (see docs/ENVIRONMENT.md).
        </Note>
      </Card>
    )
  }

  const h = await headers()
  const visitor = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  const result = await aiSearch(question, visitor)

  if (result.status === 'ok') return <Answer result={result} />
  const message: Record<Exclude<AiResult['status'], 'ok'>, string> = {
    invalid: 'AI ഉത്തരത്തിന് കുറച്ചുകൂടി വിശദമായി ചോദ്യം ടൈപ്പ് ചെയ്യുക.',
    'no-results':
      'ഈ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ ഉതകുന്ന ലേഖനങ്ങൾ കണ്ടെത്താനായില്ല. മറ്റൊരു രീതിയിൽ ചോദിച്ചു നോക്കൂ.',
    limited:
      'ഇപ്പോൾ ധാരാളം AI ചോദ്യങ്ങൾ ലഭിക്കുന്നു. അല്പം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക — താഴെ തിരയൽ ഫലങ്ങൾ കാണാം.',
    refused: 'ഈ ചോദ്യത്തിന് AI ഉത്തരം നൽകാനായില്ല. താഴെയുള്ള തിരയൽ ഫലങ്ങൾ നോക്കുക.',
    unavailable: 'AI ഉത്തരം ഇപ്പോൾ ലഭ്യമല്ല. താഴെയുള്ള തിരയൽ ഫലങ്ങൾ നോക്കുക.',
  }
  return (
    <Card>
      <Note>{message[result.status]}</Note>
    </Card>
  )
}
