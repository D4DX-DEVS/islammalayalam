import { Secret, TOTP } from 'otpauth'
import { describe, expect, it } from 'vitest'
import { matchStep } from '@/payload/plugins/totpGuard'

const secret = new Secret({ size: 20 })
const opts = { algorithm: 'SHA1', digits: 6, period: 30 }
const totp = new TOTP({ ...opts, secret })
const NOW = Date.UTC(2026, 8, 29, 12, 0, 15)
const step = Math.floor(NOW / 30_000)
const codeAt = (offsetSteps: number) => totp.generate({ timestamp: NOW + offsetSteps * 30_000 })

describe('matchStep (TOTP code → time step)', () => {
  it('maps the current code and ±1 step of clock drift to their own steps', () => {
    expect(matchStep(codeAt(0), secret.base32, opts, NOW)).toBe(step)
    expect(matchStep(codeAt(-1), secret.base32, opts, NOW)).toBe(step - 1)
    expect(matchStep(codeAt(1), secret.base32, opts, NOW)).toBe(step + 1)
  })

  it('rejects codes outside the window', () => {
    for (const offset of [-3, -2, 2, 3]) {
      const code = codeAt(offset)
      if ([-1, 0, 1].some((o) => codeAt(o) === code)) continue // astronomically rare collision
      expect(matchStep(code, secret.base32, opts, NOW)).toBeNull()
    }
  })

  it('rejects malformed input and a broken secret without throwing', () => {
    for (const token of [
      undefined,
      123456,
      '',
      '12345',
      '1234567',
      '12 456',
      'abcdef',
      `${codeAt(0)}\n`,
    ]) {
      expect(matchStep(token, secret.base32, opts, NOW)).toBeNull()
    }
    expect(matchStep(codeAt(0), '!!!not-base32!!!', opts, NOW)).toBeNull()
  })
})
