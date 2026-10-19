import { describe, expect, it } from 'vitest'
import { twoStepConfirm, twoStepStatus, twoStepToast } from '@/payload/admin/mfa/twoStepCopy'

describe('two-step verification copy (Settings → Security)', () => {
  it('explains the current state in plain words', () => {
    expect(twoStepStatus(true)).toMatch(/code/i)
    expect(twoStepStatus(false)).toMatch(/password alone/i)
  })

  it('turning on: says what every staff member will see', () => {
    const c = twoStepConfirm(true, null)
    expect(c.heading).toMatch(/turn on/i)
    expect(c.body).toMatch(/6-digit code/i)
    expect(c.body).toMatch(/QR code/i)
    expect(c.body).not.toMatch(/\byou\b/i)
    expect(c.confirmLabel).toBe('Turn on')
  })

  it('turning on without an app of my own: warns I will be asked to scan a QR code next', () => {
    expect(twoStepConfirm(true, 'setup').body).toMatch(/you .*scan a QR code/i)
  })

  it('turning on from a password-only session: warns I will be asked for my code next', () => {
    expect(twoStepConfirm(true, 'verify').body).toMatch(/you .*your code/i)
  })

  it('turning off: spells out the risk and that nothing is lost', () => {
    const c = twoStepConfirm(false, null)
    expect(c.heading).toMatch(/turn off/i)
    expect(c.body).toMatch(/password/i)
    expect(c.body).toMatch(/kept/i)
    expect(c.confirmLabel).toBe('Turn off')
  })

  it('toasts name the new state', () => {
    expect(twoStepToast(true)).toMatch(/is on/i)
    expect(twoStepToast(false)).toMatch(/is off/i)
  })
})
