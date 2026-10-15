import { describe, expect, it } from 'vitest'
import { parsePostalRequest } from '@/features/postal/schema'

const valid = {
  name: ' Abdul Rahman ',
  age: '34',
  gender: 'male',
  address: 'House 1\r\nKozhikode',
  pincode: '673004',
  phone: '+91 98765-43210',
  email: ' Reader@Example.COM ',
  education: 'Degree',
  religion: 'Hindu',
  orgMember: 'no',
  readBefore: 'Yes, a translation of the Quran',
  difficulties: 'Nothing in particular',
  favouriteAspect: 'Social justice',
  wantsToLearn: 'Prophet biography',
}

describe('parsePostalRequest', () => {
  it('accepts a complete submission and normalises it', () => {
    const res = parsePostalRequest(valid)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toMatchObject({
      name: 'Abdul Rahman',
      age: 34,
      gender: 'male',
      address: 'House 1\nKozhikode',
      email: 'reader@example.com',
      orgMember: 'no',
    })
  })

  it('treats the organisation question as optional', () => {
    for (const orgMember of [undefined, '', '  ']) {
      const res = parsePostalRequest({ ...valid, orgMember })
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.data.orgMember).toBeUndefined()
    }
  })

  it('reports every missing required field, one message each', () => {
    const res = parsePostalRequest({})
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(Object.keys(res.errors).sort()).toEqual(
      [
        'address',
        'age',
        'difficulties',
        'education',
        'email',
        'favouriteAspect',
        'gender',
        'name',
        'phone',
        'pincode',
        'readBefore',
        'religion',
        'wantsToLearn',
      ].sort(),
    )
    expect(res.errors.orgMember).toBeUndefined()
  })

  it.each([
    ['age', 'abc'],
    ['age', '4'],
    ['age', '121'],
    ['age', '12.5'],
    ['gender', 'other'],
    ['pincode', '12'],
    ['pincode', '<script>'],
    ['phone', '12345'],
    ['phone', 'call me maybe'],
    ['phone', '1234567890123456'],
    ['email', 'not-an-email'],
    ['email', 'a@b'],
    ['orgMember', 'maybe'],
  ])('rejects %s = %j', (field, value) => {
    const res = parsePostalRequest({ ...valid, [field]: value })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors[field as keyof typeof res.errors]).toBeTruthy()
  })

  it('enforces length limits', () => {
    expect(parsePostalRequest({ ...valid, name: 'x'.repeat(121) }).ok).toBe(false)
    expect(parsePostalRequest({ ...valid, name: 'x'.repeat(120) }).ok).toBe(true)
    expect(parsePostalRequest({ ...valid, wantsToLearn: 'x'.repeat(2001) }).ok).toBe(false)
    expect(parsePostalRequest({ ...valid, email: `${'a'.repeat(250)}@x.io` }).ok).toBe(false)
  })

  it('strips control characters and rejects whitespace-only answers', () => {
    const res = parsePostalRequest({ ...valid, name: 'Ab\u0000dul\u0007' })
    expect(res.ok && res.data.name).toBe('Abdul')
    expect(parsePostalRequest({ ...valid, address: '   \n  ' }).ok).toBe(false)
  })

  it('ignores non-string values instead of throwing', () => {
    const res = parsePostalRequest({ ...valid, name: { $ne: '' }, phone: ['1'] })
    expect(res.ok).toBe(false)
  })

  it('accepts Malayalam text and international phone formats', () => {
    const res = parsePostalRequest({
      ...valid,
      name: 'അബ്ദുൽ റഹ്മാൻ',
      address: 'വീട് നമ്പർ 5, കോഴിക്കോട്',
      phone: '0495 4024510',
    })
    expect(res.ok).toBe(true)
  })
})
