import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT, resolvePort } from '../../scripts/start-port.mjs'

/**
 * `npm start` must work the same on DigitalOcean (sh, PORT set by the platform) and on a Windows
 * PC (cmd.exe, no PORT) — a shell expansion like `${PORT:-3444}` is passed literally by cmd.exe
 * and `next start` then refuses it as an invalid port.
 */
describe('resolvePort (scripts/start.mjs)', () => {
  it('uses 3444 when PORT is unset, so a local production preview matches NEXT_PUBLIC_SERVER_URL', () => {
    expect(DEFAULT_PORT).toBe('3444')
    expect(resolvePort({})).toBe('3444')
    expect(resolvePort({ PORT: undefined })).toBe('3444')
  })

  it('treats an empty PORT like an unset one (what `${PORT:-3444}` does in sh)', () => {
    expect(resolvePort({ PORT: '' })).toBe('3444')
    expect(resolvePort({ PORT: '   ' })).toBe('3444')
  })

  it("uses the platform's PORT when it is a valid TCP port", () => {
    expect(resolvePort({ PORT: '8080' })).toBe('8080')
    expect(resolvePort({ PORT: ' 3000 ' })).toBe('3000')
    expect(resolvePort({ PORT: '65535' })).toBe('65535')
  })

  it('refuses a PORT that is not a TCP port instead of silently starting elsewhere', () => {
    for (const bad of ['abc', '${PORT:-3444}', '-1', '0', '65536', '80.5', '8080x'])
      expect(() => resolvePort({ PORT: bad }), bad).toThrow(/PORT/)
  })
})
