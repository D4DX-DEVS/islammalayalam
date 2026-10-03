import { expect, test } from '@playwright/test'

test.describe('security headers', () => {
  test('public pages: nonce CSP that matches every server-rendered script tag, plus hardening headers', async ({
    request,
  }) => {
    const res = await request.get('/')
    const h = res.headers()
    const csp = h['content-security-policy'] ?? ''
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    expect(nonce, 'CSP carries a nonce').toBeTruthy()
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!
    expect(script).not.toContain("'unsafe-inline'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['cross-origin-opener-policy']).toBe('same-origin')
    expect(h['permissions-policy']).toContain('camera=()')
    expect(h['x-powered-by']).toBeUndefined()
    // Parser-inserted scripts must carry this response's nonce. Scripts those create at runtime
    // (chunk loading, dev HMR) are trusted through 'strict-dynamic' and legitimately have none.
    const tags = (await res.text()).match(/<script\b[^>]*>/g) ?? []
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(/\snonce="([^"]+)"/.exec(tag)?.[1], tag.slice(0, 80)).toBe(nonce)
  })

  test('each response gets a fresh nonce', async ({ request }) => {
    const a = (await request.get('/')).headers()['content-security-policy']
    const b = (await request.get('/')).headers()['content-security-policy']
    expect(a).not.toBe(b)
  })

  test('admin has its own CSP and is never frameable', async ({ request }) => {
    const res = await request.get('/admin/login', { maxRedirects: 0 })
    const csp = res.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("'nonce-")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('youtube')
  })
})

test.describe('anonymous API surface', () => {
  test('private collections are closed', async ({ request }) => {
    for (const path of [
      '/api/users',
      '/api/audit-logs',
      '/api/redirects',
      '/api/contact-messages',
      '/api/migration-runs',
      '/api/migration-issues',
    ]) {
      expect((await request.get(path)).status(), path).toBe(403)
    }
  })

  test('GraphQL is disabled', async ({ request }) => {
    expect(
      (
        await request.post('/api/graphql', { data: { query: '{ __schema { types { name } } }' } })
      ).status(),
    ).toBe(404)
  })

  test('drafts and staff-only fields never leak', async ({ request }) => {
    const res = await request.get('/api/posts?draft=true&limit=100&depth=0')
    expect(res.status()).toBe(200)
    const { docs } = (await res.json()) as { docs: Array<Record<string, unknown>> }
    expect(docs.length).toBeGreaterThan(0)
    for (const d of docs) {
      expect(d._status).toBe('published')
      for (const field of ['flags', 'createdBy', 'legacy', 'searchText'])
        expect(d).not.toHaveProperty(field)
    }
  })

  test('JSON responses cannot be rendered as documents', async ({ request }) => {
    const h = (await request.get('/api/posts?limit=1')).headers()
    expect(h['content-security-policy']).toContain("default-src 'none'")
    expect(h['x-content-type-options']).toBe('nosniff')
  })

  test('anonymous writes are refused', async ({ request }) => {
    expect((await request.post('/api/posts', { data: { title: 'x' } })).status()).toBe(403)
    expect((await request.post('/api/globals/header', { data: { mainMenu: [] } })).status()).toBe(
      403,
    )
  })
})
