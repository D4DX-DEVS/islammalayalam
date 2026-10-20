import { describe, expect, it } from 'vitest'
import { PRODUCTION_CDN_URL, cdnUrl, cdnUrlFrom, spacesEndpoint, spacesFolder } from '@/lib/spaces'

describe('cdnUrl', () => {
  it('accepts a host name or an https URL and drops the trailing slash', () => {
    expect(cdnUrl('bucket.blr1.cdn.digitaloceanspaces.com')).toBe(
      'https://bucket.blr1.cdn.digitaloceanspaces.com',
    )
    expect(cdnUrl('https://bucket.blr1.cdn.digitaloceanspaces.com/')).toBe(
      'https://bucket.blr1.cdn.digitaloceanspaces.com',
    )
  })

  it('is undefined when unset or not https', () => {
    expect(cdnUrl(undefined)).toBeUndefined()
    expect(cdnUrl('')).toBeUndefined()
    expect(cdnUrl('http://bucket.blr1.cdn.digitaloceanspaces.com')).toBeUndefined()
  })
})

/**
 * next.config.ts bakes the CDN host into the image allowlist at build time. If the host's build
 * step lacks DO_SPACES_CDN_ENDPOINT (App Platform scope "run" only), a production build must still
 * allow the real CDN, or every media image fails in next/image.
 */
describe('cdnUrlFrom (build-time CDN host)', () => {
  it('prefers the configured endpoint', () => {
    expect(cdnUrlFrom('other.blr1.cdn.digitaloceanspaces.com', 'production')).toBe(
      'https://other.blr1.cdn.digitaloceanspaces.com',
    )
    expect(cdnUrlFrom('other.blr1.cdn.digitaloceanspaces.com', 'development')).toBe(
      'https://other.blr1.cdn.digitaloceanspaces.com',
    )
  })

  it('falls back to the production CDN only for a production build', () => {
    expect(PRODUCTION_CDN_URL).toMatch(/^https:\/\/[a-z0-9.-]+\.cdn\.digitaloceanspaces\.com$/)
    expect(cdnUrlFrom(undefined, 'production')).toBe(PRODUCTION_CDN_URL)
    expect(cdnUrlFrom('', 'production')).toBe(PRODUCTION_CDN_URL)
  })

  it('stays unset in development and test so local media is served from ./media', () => {
    expect(cdnUrlFrom(undefined, 'development')).toBeUndefined()
    expect(cdnUrlFrom(undefined, 'test')).toBeUndefined()
    expect(cdnUrlFrom(undefined, undefined)).toBeUndefined()
  })
})

describe('spacesEndpoint / spacesFolder', () => {
  it('derives the region and refuses look-alike hosts', () => {
    expect(spacesEndpoint('blr1.digitaloceanspaces.com')).toEqual({
      endpoint: 'https://blr1.digitaloceanspaces.com',
      region: 'blr1',
    })
    expect(() => spacesEndpoint('blr1.digitaloceanspaces.com.attacker.invalid')).toThrow()
  })

  it('trims folder slashes', () => {
    expect(spacesFolder('/ISLAMMALAYALAM/')).toBe('ISLAMMALAYALAM')
    expect(spacesFolder(undefined)).toBe('')
  })
})
