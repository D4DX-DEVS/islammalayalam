/**
 * The postal-library form's field list, limits and option values. Plain constants (no zod) so the
 * browser bundle, the admin collection and the validation all share them cheaply.
 */
export const GENDERS = ['male', 'female'] as const
export const ORG_ANSWERS = ['yes', 'no'] as const
export const STATUSES = ['new', 'in-progress', 'member', 'closed', 'spam'] as const

export const LIMITS = {
  name: 120,
  address: 600,
  education: 200,
  religion: 100,
  answer: 2000,
} as const

export const FIELD_NAMES = [
  'name',
  'age',
  'gender',
  'address',
  'pincode',
  'phone',
  'email',
  'education',
  'religion',
  'orgMember',
  'readBefore',
  'difficulties',
  'favouriteAspect',
  'wantsToLearn',
] as const
export type FieldName = (typeof FIELD_NAMES)[number]
export type FieldErrors = Partial<Record<FieldName, string>>
