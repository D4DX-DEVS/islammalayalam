import { describe, expect, it } from 'vitest'
import { confirmRuleFor } from '@/payload/admin/enhancements/confirmRules'

const heading = (id: string, path: string, label = 'Save') =>
  confirmRuleFor(id, path, label)?.heading

describe('admin confirmations', () => {
  it('asks before publishing a post, not before saving a draft', () => {
    expect(heading('action-save', '/admin/collections/posts/abc', 'Publish changes')).toMatch(
      /publish/i,
    )
    expect(heading('action-save', '/admin/collections/posts/create', 'Publish')).toMatch(/publish/i)
    expect(
      heading('action-save-draft', '/admin/collections/posts/abc', 'Save draft'),
    ).toBeUndefined()
  })

  it('asks before saving pages, accounts and site settings', () => {
    expect(heading('action-save', '/admin/collections/pages/abc')).toMatch(/live page/i)
    expect(heading('action-save', '/admin/collections/users/abc')).toMatch(/account/i)
    expect(heading('action-save', '/admin/account/')).toMatch(/account/i)
    expect(heading('action-save', '/admin/globals/header')).toMatch(/website/i)
  })

  it('asks before force-unlocking an account', () => {
    expect(heading('force-unlock', '/admin/collections/users/abc')).toMatch(/unlock/i)
  })

  it('leaves everyday saves alone', () => {
    expect(heading('action-save', '/admin/collections/media/abc')).toBeUndefined()
    expect(heading('action-save', '/admin/collections/categories/abc')).toBeUndefined()
    expect(heading('action-unpublish', '/admin/collections/posts/abc')).toBeUndefined()
  })
})
