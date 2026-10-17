import { describe, expect, it } from 'vitest'
import { mfaSatisfied, pendingMfaStep, type MfaRoutes } from '@/lib/mfa-policy'

const routes: MfaRoutes = {
  verify: '/admin/verify-totp',
  setup: '/admin/setup-totp',
  open: ['/admin/logout', '/admin/logout-inactivity'],
}
const enrolled = { hasTotp: true, mfaRequired: true }
const notEnrolled = { hasTotp: false, mfaRequired: true }

describe('mfaSatisfied', () => {
  it('requires the code step while the setting is on (or unknown)', () => {
    expect(mfaSatisfied({ ...enrolled, _strategy: 'totp' })).toBe(true)
    expect(mfaSatisfied({ ...enrolled, _strategy: 'local-jwt' })).toBe(false)
    expect(mfaSatisfied({ ...notEnrolled, _strategy: 'local-jwt' })).toBe(false)
    // Missing setting value fails closed.
    expect(mfaSatisfied({ hasTotp: true, _strategy: 'local-jwt' })).toBe(false)
    expect(mfaSatisfied({ hasTotp: true, mfaRequired: null, _strategy: 'local-jwt' })).toBe(false)
  })

  it('accepts the password alone only when the setting is explicitly off', () => {
    expect(mfaSatisfied({ hasTotp: true, mfaRequired: false, _strategy: 'local-jwt' })).toBe(true)
    expect(mfaSatisfied({ hasTotp: false, mfaRequired: false, _strategy: 'local-jwt' })).toBe(true)
  })
})

describe('pendingMfaStep', () => {
  it('sends an enrolled user to the code screen, never to the QR setup', () => {
    const user = { ...enrolled, _strategy: 'local-jwt' }
    expect(pendingMfaStep(user, '/admin', routes)).toBe('verify')
    expect(pendingMfaStep(user, '/admin/setup-totp', routes)).toBe('verify')
    expect(pendingMfaStep(user, '/admin/verify-totp/', routes)).toBeNull()
  })

  it('sends a user without an authenticator app to the QR setup', () => {
    const user = { ...notEnrolled, _strategy: 'local-jwt' }
    expect(pendingMfaStep(user, '/admin/collections/posts', routes)).toBe('setup')
    expect(pendingMfaStep(user, '/admin/setup-totp', routes)).toBeNull()
  })

  it('redirects nobody once signed in, when signed out, or with the setting off', () => {
    expect(pendingMfaStep({ ...enrolled, _strategy: 'totp' }, '/admin', routes)).toBeNull()
    expect(pendingMfaStep(null, '/admin', routes)).toBeNull()
    expect(
      pendingMfaStep(
        { hasTotp: false, mfaRequired: false, _strategy: 'local-jwt' },
        '/admin',
        routes,
      ),
    ).toBeNull()
    expect(
      pendingMfaStep(
        { hasTotp: true, mfaRequired: false, _strategy: 'local-jwt' },
        '/admin',
        routes,
      ),
    ).toBeNull()
  })

  it('always lets an unverified user sign out', () => {
    const user = { ...enrolled, _strategy: 'local-jwt' }
    expect(pendingMfaStep(user, '/admin/logout', routes)).toBeNull()
    expect(pendingMfaStep(user, '/admin/logout-inactivity/', routes)).toBeNull()
  })
})
