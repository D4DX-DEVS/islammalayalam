import { z } from 'zod'
import {
  FIELD_NAMES,
  GENDERS,
  LIMITS,
  ORG_ANSWERS,
  STATUSES,
  type FieldErrors,
  type FieldName,
} from './constants'

/**
 * The postal-library membership form: field list, limits and validation, shared by the form, the
 * server action and the admin collection. Pure (no I/O) so it is unit-tested. Messages are shown to
 * visitors in Malayalam, like the form's labels.
 */
export { FIELD_NAMES, GENDERS, LIMITS, ORG_ANSWERS, STATUSES, type FieldErrors, type FieldName }

const MSG = {
  required: 'ഈ വിവരം ആവശ്യമാണ്',
  tooLong: 'ദൈർഘ്യം കൂടുതലാണ്',
  age: 'ശരിയായ വയസ്സ് നൽകുക',
  choice: 'ഒരെണ്ണം തിരഞ്ഞെടുക്കുക',
  pincode: 'ശരിയായ പിൻകോഡ് നൽകുക',
  phone: 'ശരിയായ ഫോൺ നമ്പർ നൽകുക',
  email: 'ശരിയായ ഇ-മെയിൽ വിലാസം നൽകുക',
} as const

// Control characters (except tab/newline) have no place in a postal address or an answer.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Trim, normalise line endings and drop control characters; non-strings become ''. */
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(CONTROL, '').replace(/\r\n?/g, '\n').trim() : ''

const text = (max: number) =>
  z.preprocess(clean, z.string().min(1, MSG.required).max(max, MSG.tooLong))

const digitCount = (value: string) => value.replace(/\D/g, '').length

const schema = z.object({
  name: text(LIMITS.name),
  age: z.preprocess(
    clean,
    z
      .string()
      .regex(/^\d{1,3}$/, MSG.age)
      .transform(Number)
      .pipe(z.number().min(5, MSG.age).max(120, MSG.age)),
  ),
  gender: z.preprocess(clean, z.enum(GENDERS, { error: MSG.choice })),
  address: text(LIMITS.address),
  pincode: z.preprocess(
    clean,
    z
      .string()
      .min(1, MSG.required)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/, MSG.pincode),
  ),
  phone: z.preprocess(
    clean,
    z
      .string()
      .min(1, MSG.required)
      .regex(/^\+?[\d\s\-()]{8,22}$/, MSG.phone)
      .refine((v) => digitCount(v) >= 8 && digitCount(v) <= 15, MSG.phone),
  ),
  email: z.preprocess(
    clean,
    z
      .string()
      .min(1, MSG.required)
      .max(254, MSG.tooLong)
      .pipe(z.email(MSG.email))
      .transform((v) => v.toLowerCase()),
  ),
  education: text(LIMITS.education),
  religion: text(LIMITS.religion),
  // Not marked required on the original form.
  orgMember: z.preprocess(
    (v) => clean(v) || undefined,
    z.enum(ORG_ANSWERS, { error: MSG.choice }).optional(),
  ),
  readBefore: text(LIMITS.answer),
  difficulties: text(LIMITS.answer),
  favouriteAspect: text(LIMITS.answer),
  wantsToLearn: text(LIMITS.answer),
})

export type PostalRequestInput = z.output<typeof schema>

export type ParseResult =
  | { ok: true; data: PostalRequestInput }
  | { ok: false; errors: FieldErrors }

/** Validate a submission (e.g. `Object.fromEntries(formData)`); one message per failing field. */
export function parsePostalRequest(raw: Record<string, unknown>): ParseResult {
  const result = schema.safeParse(raw)
  if (result.success) return { ok: true, data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && (FIELD_NAMES as readonly string[]).includes(field))
      errors[field as FieldName] ??= issue.message
  }
  return { ok: false, errors }
}
