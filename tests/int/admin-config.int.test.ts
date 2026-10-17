import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import { SECURITY_SETTINGS } from '@/payload/mfa'
import { testPayload } from './helpers'

let payload: Payload

beforeAll(async () => {
  payload = await testPayload()
})

/** Admin UI decisions made for a non-technical admin, checked on the sanitized config. */
describe('admin config for a non-technical admin', () => {
  it('hides the API tab and API URL on every screen', () => {
    // Collections Payload keeps for itself (payload-kv, ...) have no screen, so no tab to hide.
    const shown = payload.config.collections.filter((c) => c.admin.hidden !== true)
    expect(shown.length).toBeGreaterThan(10)
    for (const c of shown) expect(c.admin.hideAPIURL, `collection ${c.slug}`).toBe(true)
    for (const g of payload.config.globals)
      expect(g.admin.hideAPIURL, `global ${g.slug}`).toBe(true)
  })

  it('Settings → Security is one self-saving switch with no Save button', () => {
    const security = payload.config.globals.find((g) => g.slug === SECURITY_SETTINGS)
    expect(security).toBeDefined()
    const path = (c: unknown) => (typeof c === 'string' ? c : (c as { path?: string })?.path)
    expect(path(security?.admin.components?.elements?.SaveButton)).toMatch(/NoSaveButton/)
    const field = security?.fields.find((f) => 'name' in f && f.name === 'requireTwoFactor')
    expect(field?.type).toBe('checkbox')
    expect(path(field?.admin?.components?.Field)).toMatch(/TwoStepSwitch/)
  })
})
