'use client'

import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { submitPostalRequest, type PostalFormState } from '@/features/postal/actions'
import { FIELD_NAMES, LIMITS, type FieldErrors, type FieldName } from '@/features/postal/constants'
import { LABELS } from '@/features/postal/labels'

/**
 * The postal-library membership form. Validation is the server's (features/postal/schema.ts), so the
 * browser and the database always agree; the form keeps what was typed and moves focus to the first
 * problem. Every error is icon + words, never colour alone.
 */
const initial: PostalFormState = { status: 'idle' }

const CONTROL =
  'block w-full rounded-xl border bg-card px-4 text-base text-ink shadow-sm transition placeholder:text-muted/70 hover:border-brand/50 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
const ERROR_TEXT = 'text-red-700 dark:text-red-300'

function Required() {
  return (
    <span className="ms-0.5 text-red-600 dark:text-red-400" aria-hidden="true">
      *
    </span>
  )
}

function ErrorLine({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className={`mt-1.5 flex items-start gap-1.5 text-sm ${ERROR_TEXT}`}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

function Field({
  name,
  label,
  error,
  hint,
  required = true,
  className = '',
  children,
}: {
  name: FieldName
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (props: { id: string; className: string; describedBy?: string }) => ReactNode
}) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold leading-snug text-ink">
        {label}
        {required ? <Required /> : null}
      </label>
      {children({
        id: name,
        className: `${CONTROL} ${error ? 'border-red-500' : 'border-line'}`,
        describedBy: describedBy || undefined,
      })}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      <ErrorLine id={errorId} message={error} />
    </div>
  )
}

function Choice({
  name,
  legend,
  options,
  value,
  error,
  required = true,
  className = '',
}: {
  name: FieldName
  legend: string
  options: Array<{ value: string; label: string }>
  value?: string
  error?: string
  required?: boolean
  className?: string
}) {
  const errorId = `${name}-error`
  return (
    <fieldset className={className} aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-semibold leading-snug text-ink">
        {legend}
        {required ? <Required /> : null}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option, i) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              // The first radio is the one focused when the group has an error.
              id={i === 0 ? name : undefined}
              className="peer sr-only"
            />
            <span
              className={`inline-flex min-h-12 min-w-28 cursor-pointer items-center justify-center rounded-xl border bg-card px-5 text-sm font-semibold text-body transition hover:border-brand/50 peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 ${error ? 'border-red-500' : 'border-line'}`}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <ErrorLine id={errorId} message={error} />
    </fieldset>
  )
}

function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-5 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-3 text-lg font-bold text-title">
        <span
          className="bg-brand-gradient inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white dark:text-slate-950"
          aria-hidden="true"
        >
          {number}
        </span>
        {title}
      </h3>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Success() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="rounded-2xl bg-brand-soft p-8 text-center outline-none ring-1 ring-brand/20 sm:p-12"
    >
      <span className="bg-brand-gradient mx-auto inline-flex size-16 items-center justify-center rounded-full text-white shadow-card dark:text-slate-950">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-2xl font-bold text-title">നന്ദി!</h3>
      <p className="mx-auto mt-2 max-w-md leading-relaxed text-body">
        താങ്കളുടെ അപേക്ഷ ലഭിച്ചു. പുസ്തകങ്ങൾ അയച്ചുതുടങ്ങുന്നതിനുള്ള ക്രമീകരണങ്ങൾ
        ഏർപ്പെടുത്തുന്നതാണ്.
      </p>
    </div>
  )
}

export function PostalRequestForm() {
  const [state, action, pending] = useActionState(submitPostalRequest, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const errors: FieldErrors = state.status === 'error' ? state.errors : {}
  const values: Record<string, string> = state.status === 'error' ? state.values : {}

  // After a failed submit, jump to the first field with a problem (or the message if there is none).
  useEffect(() => {
    if (state.status !== 'error') return
    const first = FIELD_NAMES.find((name) => state.errors[name])
    const target = first ? formRef.current?.querySelector<HTMLElement>(`#${first}`) : null
    ;(target ?? alertRef.current)?.focus()
  }, [state])

  if (state.status === 'success') return <Success />

  return (
    <form ref={formRef} action={action} noValidate className="mt-8 space-y-8">
      {state.status === 'error' && state.message ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className={`flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm font-medium outline-none ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900 ${ERROR_TEXT}`}
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {state.message}
        </div>
      ) : null}

      {/* Honeypot: invisible to people and to screen readers; bots tend to fill every input. */}
      <div aria-hidden="true" className="absolute -start-[9999px] size-0 overflow-hidden">
        <label>
          Leave this field blank
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Section number={1} title="വ്യക്തിവിവരങ്ങൾ">
        <Field name="name" label={LABELS.name} error={errors.name} className="sm:col-span-2">
          {(p) => (
            <input
              id={p.id}
              name="name"
              type="text"
              autoComplete="name"
              maxLength={LIMITS.name}
              defaultValue={values.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
        <Field name="age" label={LABELS.age} error={errors.age}>
          {(p) => (
            <input
              id={p.id}
              name="age"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              defaultValue={values.age}
              aria-invalid={errors.age ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
        <Choice
          name="gender"
          legend={LABELS.gender}
          value={values.gender}
          error={errors.gender}
          options={[
            { value: 'male', label: LABELS.male },
            { value: 'female', label: LABELS.female },
          ]}
        />
        <Field name="education" label={LABELS.education} error={errors.education}>
          {(p) => (
            <input
              id={p.id}
              name="education"
              type="text"
              maxLength={LIMITS.education}
              defaultValue={values.education}
              aria-invalid={errors.education ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
        <Field name="religion" label={LABELS.religion} error={errors.religion}>
          {(p) => (
            <input
              id={p.id}
              name="religion"
              type="text"
              maxLength={LIMITS.religion}
              defaultValue={values.religion}
              aria-invalid={errors.religion ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
      </Section>

      <Section number={2} title="ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ">
        <Field
          name="address"
          label={LABELS.address}
          error={errors.address}
          className="sm:col-span-2"
        >
          {(p) => (
            <textarea
              id={p.id}
              name="address"
              rows={3}
              autoComplete="street-address"
              maxLength={LIMITS.address}
              defaultValue={values.address}
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} min-h-24 py-3 leading-relaxed`}
            />
          )}
        </Field>
        <Field name="pincode" label={LABELS.pincode} error={errors.pincode}>
          {(p) => (
            <input
              id={p.id}
              name="pincode"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={12}
              defaultValue={values.pincode}
              aria-invalid={errors.pincode ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
        <Field name="phone" label={LABELS.phone} error={errors.phone}>
          {(p) => (
            <input
              id={p.id}
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={24}
              defaultValue={values.phone}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
        <Field name="email" label={LABELS.email} error={errors.email} className="sm:col-span-2">
          {(p) => (
            <input
              id={p.id}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={values.email}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={p.describedBy}
              className={`${p.className} h-12`}
            />
          )}
        </Field>
      </Section>

      <Section number={3} title="ഇസ്‌ലാമിനെക്കുറിച്ച്">
        <Choice
          name="orgMember"
          legend={LABELS.orgMember}
          value={values.orgMember}
          error={errors.orgMember}
          required={false}
          className="sm:col-span-2"
          options={[
            { value: 'yes', label: LABELS.yes },
            { value: 'no', label: LABELS.no },
          ]}
        />
        {(
          [
            ['readBefore', LABELS.readBefore, undefined],
            ['difficulties', LABELS.difficulties, undefined],
            ['favouriteAspect', LABELS.favouriteAspect, undefined],
            ['wantsToLearn', LABELS.wantsToLearn, LABELS.wantsToLearnHint],
          ] as const
        ).map(([name, label, hint]) => (
          <Field
            key={name}
            name={name}
            label={label}
            hint={hint}
            error={errors[name]}
            className="sm:col-span-2"
          >
            {(p) => (
              <textarea
                id={p.id}
                name={name}
                rows={4}
                maxLength={LIMITS.answer}
                defaultValue={values[name]}
                aria-invalid={errors[name] ? true : undefined}
                aria-describedby={p.describedBy}
                className={`${p.className} min-h-28 py-3 leading-relaxed`}
              />
            )}
          </Field>
        ))}
      </Section>

      <div className="flex flex-col-reverse items-stretch gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <Required /> നിർബന്ധമായും പൂരിപ്പിക്കേണ്ടവ
        </p>
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-gradient inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-9 text-base font-semibold text-white shadow-card dark:text-slate-950 transition hover:-translate-y-px hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5" aria-hidden="true" />
          )}
          {pending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
