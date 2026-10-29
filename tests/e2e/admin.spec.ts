import { mkdirSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { Secret, TOTP } from 'otpauth'

type DevAdmin = { email: string; password: string; totp: TOTP }
type CallResult = { status: number; body: string }

/**
 * Dev admin credentials are read from .env inside this process at runtime.
 * They are never printed, never asserted in a way that echoes them, and never reach an artifact.
 */
function devAdmin(): DevAdmin | null {
  let env: Record<string, string | undefined> = process.env
  if (!env.DEV_ADMIN_EMAIL) {
    try {
      env = parseEnv(readFileSync('.env', 'utf8')) as Record<string, string | undefined>
    } catch {
      return null
    }
  }
  const {
    DEV_ADMIN_EMAIL: email,
    DEV_ADMIN_PASSWORD: password,
    DEV_ADMIN_TOTP_SECRET: secret,
  } = env
  if (!email || !password || !secret) return null
  const totp = new TOTP({
    issuer: 'Islam Malayalam',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })
  return { email, password, totp }
}

/** A 6-digit code that is invalid in every window the server accepts (±1 step). */
function wrongCode(totp: TOTP): string {
  const now = Date.now()
  const valid = new Set([-1, 0, 1].map((step) => totp.generate({ timestamp: now + step * 30_000 })))
  for (let n = 0; ; n++) {
    const code = String(n).padStart(6, '0')
    if (!valid.has(code)) return code
  }
}

/**
 * Type a secret into a React-controlled input WITHOUT Playwright's `fill` (whose call log echoes the
 * value on failure). The native setter + input event is what React listens to.
 */
const fillSecret = (field: Locator, value: string): Promise<void> =>
  field.evaluate((el, v) => {
    const input = el as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)

const msToNextStep = (): number => 30_000 - (Date.now() % 30_000)

/** Same-origin fetch from inside the admin page, exactly as the admin UI itself would call the API. */
const call = (
  page: Page,
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<CallResult> =>
  page.evaluate(
    async ({ path, init }) => {
      const res = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      return { status: res.status, body: await res.text() }
    },
    { path, init },
  )

const SHOTS = '.logs/e2e'
// Playwright hides the text caret by writing inline styles onto inputs; mid-hydration that trips React's
// hydration check. Leave the caret alone.
const SHOT = { caret: 'initial' } as const
const admin = devAdmin()

test.use({ screenshot: 'off' })
test.skip(!admin, 'DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD / DEV_ADMIN_TOTP_SECRET not configured')
// Dev credentials never leave this machine, whatever E2E_BASE_URL says.
test.skip(
  ({ baseURL }) => !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL ?? ''),
  'admin spec runs against localhost only',
)

test('admin: password + TOTP sign-in, locked-down API, admin views load under the admin CSP', async ({
  page,
  request,
}) => {
  const { email, password, totp } = admin!
  mkdirSync(SHOTS, { recursive: true })
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  await test.step('anonymous visitors are sent to the login screen', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.locator('#field-email')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/admin-login.png`, ...SHOT })
  })

  await test.step('a correct password alone does not open the API', async () => {
    await fillSecret(page.locator('#field-email'), email)
    await fillSecret(page.locator('#field-password'), password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/admin\/verify-totp/)
    await page.screenshot({ path: `${SHOTS}/admin-verify-totp.png`, ...SHOT })
    expect((await call(page, '/api/audit-logs?limit=1')).status).toBe(403)
    expect(
      (await call(page, '/api/posts?draft=true&limit=1')).status,
      'no draft access before TOTP',
    ).toBe(403)
    expect(
      (await call(page, `/next/preview/?collection=posts&id=${'0'.repeat(24)}`)).status,
      'no preview before TOTP (a verified session would get 404 for this id)',
    ).toBe(403)
  })

  await test.step('a wrong TOTP code is refused', async () => {
    const res = await call(page, '/api/verify-totp', {
      method: 'POST',
      body: JSON.stringify({ token: wrongCode(totp) }),
    })
    expect(JSON.parse(res.body).ok).toBe(false)
    expect((await call(page, '/api/audit-logs?limit=1')).status).toBe(403)
  })

  await test.step('the right TOTP code completes sign-in', async () => {
    const isDashboard = (url: URL) => url.pathname.replace(/\/$/, '') === '/admin'
    const enterCode = async () => {
      await page.locator('form input[type="text"]').first().click()
      await page.keyboard.type(totp.generate(), { delay: 40 })
    }
    await enterCode()
    // A run within the same 30 s window already used this code; replay protection refuses it.
    const replayed = page.getByText('already used').first()
    await expect(async () => {
      if (!isDashboard(new URL(page.url())) && !(await replayed.isVisible()))
        throw new Error('waiting for the code check')
    }).toPass({ timeout: 20_000 })
    if (!isDashboard(new URL(page.url()))) {
      await page.waitForTimeout(msToNextStep() + 1_000)
      await enterCode()
      await page.waitForURL(isDashboard)
    }
    await expect(page.locator('.dashboard')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true, ...SHOT })
  })

  await test.step('session cookies are httpOnly and never cross-site', async () => {
    const cookies = (await page.context().cookies()).filter((c) => c.name.startsWith('payload'))
    expect(cookies.map((c) => c.name).sort()).toEqual(['payload-token', 'payload-totp'])
    for (const c of cookies) {
      expect(c.httpOnly, c.name).toBe(true)
      expect(c.sameSite, c.name).not.toBe('None')
    }
  })

  await test.step('staff API opens after TOTP and the sign-in was audited', async () => {
    const res = await call(page, '/api/audit-logs?limit=5&sort=-createdAt&depth=0')
    expect(res.status).toBe(200)
    const { docs } = JSON.parse(res.body) as {
      docs: Array<{ action: string; collection?: string }>
    }
    expect(docs.some((d) => d.action === 'login')).toBe(true)
  })

  await test.step('remote-URL media uploads are refused before any fetch', async () => {
    const res = await call(page, '/api/media', {
      method: 'POST',
      body: JSON.stringify({ alt: 'x', url: 'https://example.org/a.jpg', filename: 'a.jpg' }),
    })
    expect(res.status).toBe(400)
    expect(res.body).toContain('remote URL uploads are disabled')
  })

  await test.step('editor screens render (collections, rich-text editor, homepage builder)', async () => {
    await page.goto('/admin/collections/posts')
    await expect(page.locator('.collection-list')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/admin-posts.png`, ...SHOT })
    const { docs } = JSON.parse(
      (await call(page, '/api/posts?limit=1&depth=0&sort=-postNumber')).body,
    ) as { docs: Array<{ id: string }> }
    await page.goto(`/admin/collections/posts/${docs[0]!.id}`)
    await expect(page.locator('[data-lexical-editor="true"]').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/admin-post-edit.png`, fullPage: true, ...SHOT })
    await page.goto('/admin/globals/homepage')
    await expect(page.locator('form').first()).toBeVisible()
    // Block rows render their fields (not just the header) — first block is the hero.
    await expect(page.getByText('Posts marked "Featured"').first()).toBeVisible()
    // Every saved category shows its name (six blocks reference a category), including rows far down.
    await page.mouse.wheel(0, 20_000)
    await expect(page.locator('.relationship--single-value')).toHaveCount(6)
    await page.screenshot({ path: `${SHOTS}/admin-homepage.png`, fullPage: true, ...SHOT })
  })

  await test.step('list toolbar: tabs, filter chips, Columns menu and Advanced replace the pill wall', async () => {
    await page.goto('/admin/collections/posts')
    const list = page.locator('.collection-list')
    const toolbar = list.locator('.im-list-toolbar')
    await expect(toolbar).toBeVisible()
    // Payload's own Columns / Filters pills and its wall of column pills are gone.
    await expect(list.locator('.list-controls__toggle-columns')).toBeHidden()
    await expect(list.locator('.list-controls__columns')).toBeHidden()
    const tabs = toolbar.getByRole('group', { name: 'Show' })
    await expect(tabs.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')

    // Columns: shown columns in table order, the rest grouped; no WordPress plumbing on offer.
    await toolbar.getByRole('button', { name: /^Columns/ }).click()
    const columns = page.getByRole('dialog', { name: 'Choose columns' })
    await expect(columns.getByRole('list', { name: 'Shown columns' })).toContainText('Title')
    await expect(columns).not.toContainText('Source hash')
    await page.screenshot({ path: `${SHOTS}/admin-posts-columns.png`, ...SHOT })
    await page.keyboard.press('Escape')
    await expect(columns).toBeHidden()

    // A chip filters through the URL; its text says what is filtered.
    await toolbar.getByRole('button', { name: /^This post is/ }).click()
    const format = page.getByRole('dialog', { name: 'Filter by This post is' })
    await format.getByRole('checkbox', { name: 'A video' }).check()
    await expect(page).toHaveURL(/format.*video/)
    await format.getByRole('button', { name: 'Done' }).click()
    await expect(toolbar.getByRole('button', { name: 'This post is: A video' })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/admin-posts-filtered.png`, ...SHOT })
    // A filtered link opens with the chip set and Payload's own builder closed.
    await page.reload()
    await expect(toolbar.getByRole('button', { name: 'This post is: A video' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Advanced', exact: true })).toHaveAttribute('aria-pressed', 'false')

    // Tabs keep the chips, and "Clear filters" keeps the tab.
    await tabs.getByRole('button', { name: /^Drafts/ }).click()
    await expect(page).toHaveURL(/_status.*draft/)
    await expect(page).toHaveURL(/format/)
    await toolbar.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).not.toHaveURL(/format/)
    await expect(tabs.getByRole('button', { name: /^Drafts/ })).toHaveAttribute('aria-pressed', 'true')

    // Advanced opens Payload's own and/or builder below the toolbar.
    await toolbar.getByRole('button', { name: 'Advanced', exact: true }).click()
    await expect(toolbar.getByRole('button', { name: 'Advanced', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(list.locator('.list-controls__where .where-builder')).toBeVisible()
    await toolbar.getByRole('button', { name: 'Advanced', exact: true }).click()

    // Phones: a chip's panel is a sheet above the bottom bar, the page never scrolls sideways.
    await page.setViewportSize({ width: 375, height: 812 })
    await toolbar.getByRole('button', { name: /^Categories/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Filter by Categories' })
    await expect(sheet.getByRole('checkbox').first()).toBeVisible()
    const box = (await sheet.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.screenshot({ path: `${SHOTS}/admin-posts-filter-mobile.png`, ...SHOT })
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  await test.step('dashboard: totals, work queue and charts, no Create panel, no sideways scroll', async () => {
    await page.goto('/admin')
    const dash = page.locator('.im-dash')
    await expect(page.locator('.im-nav').getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(dash.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible()
    await expect(dash.getByRole('list', { name: 'Content totals' })).toBeVisible()
    await expect(dash.getByRole('link', { name: /Published posts/ }).first()).toBeVisible()
    await expect(dash.getByRole('heading', { name: 'Needs your attention' })).toBeVisible()
    await expect(dash.getByRole('heading', { name: 'Published posts by year' })).toBeVisible()
    await expect(dash.getByRole('heading', { name: 'Content mix' })).toBeVisible()
    await expect(dash.getByRole('heading', { name: 'Create', exact: true })).toHaveCount(0)
    for (const [width, height] of [
      [1280, 900],
      [768, 1024],
      [375, 812],
    ] as const) {
      await page.setViewportSize({ width, height })
      await expect(dash).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `no horizontal scroll at ${width}px`,
      ).toBe(true)
      await page.screenshot({
        path: `${SHOTS}/admin-dashboard-${width}.png`,
        fullPage: true,
        ...SHOT,
      })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  await test.step('drafts: the edit screen opens and the list Delete button removes one', async () => {
    const title = `E2E delete draft ${Date.now()}`
    const created = await call(page, '/api/posts?draft=true&depth=0', {
      method: 'POST',
      body: JSON.stringify({ title, _status: 'draft' }),
    })
    expect(created.status).toBe(201)
    const { doc } = JSON.parse(created.body) as { doc: { id: string } }
    const edit = await page.goto(`/admin/collections/posts/${doc.id}`)
    expect(edit?.status()).toBe(200)
    await expect(page.locator('[data-lexical-editor="true"]').first()).toBeVisible()
    await page.goto('/admin/collections/posts?where[_status][equals]=draft&sort=-updatedAt')
    await page.getByRole('button', { name: `Delete ${title}` }).click()
    await page.locator('.im-confirm--danger').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText(`Deleted “${title}”`)).toBeVisible()
    expect((await call(page, `/api/posts/${doc.id}?draft=true&depth=0`)).status).toBe(404)
  })

  await test.step('image upload from the admin page finishes', async () => {
    const image = readFileSync('public/brand/post-placeholder.jpg').toString('base64')
    const uploaded = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const form = new FormData()
      form.append('file', new File([bytes], `e2e-upload-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      form.append('_payload', JSON.stringify({ alt: 'E2E upload check' }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form })
      return { status: res.status, body: await res.text() }
    }, image)
    expect(uploaded.status, uploaded.body.slice(0, 300)).toBe(201)
    const { doc } = JSON.parse(uploaded.body) as { doc: { id: string } }
    expect((await call(page, `/api/media/${doc.id}`, { method: 'DELETE' })).status).toBe(200)
  })

  await test.step('live preview: drafts only for this signed-in session, updated on autosave', async () => {
    const stamp = Date.now()
    const title = `E2E preview draft ${stamp}`
    const created = await call(page, '/api/posts?draft=true&depth=0', {
      method: 'POST',
      body: JSON.stringify({ title, _status: 'draft' }),
    })
    expect(created.status).toBe(201)
    const { doc } = JSON.parse(created.body) as { doc: { id: string; postNumber: number } }
    const entry = `/next/preview/?collection=posts&id=${doc.id}`
    try {
      // Anonymous: the draft is not public and the preview route refuses to switch preview on.
      const anonPost = await request.get(`/${doc.postNumber}/`, { maxRedirects: 0 })
      expect(anonPost.status()).toBe(404)
      const anonEntry = await request.get(entry, { maxRedirects: 0 })
      expect(anonEntry.status()).toBe(403)
      expect(anonEntry.headers()['set-cookie'] ?? '').not.toMatch(/__prerender_bypass=[^;]{8,}/)
      const crossSite = await page.request.get(entry, {
        maxRedirects: 0,
        headers: { 'sec-fetch-site': 'cross-site' },
      })
      expect(crossSite.status(), 'another site cannot switch preview on').toBe(403)
      const adminFramed = await request.get('/admin/login', {
        headers: { cookie: '__prerender_bypass=forged' },
      })
      expect(adminFramed.headers()['x-frame-options'], 'admin never frameable').toBe('DENY')
      const forged = await request.get(`/${doc.postNumber}/`, {
        maxRedirects: 0,
        headers: { cookie: '__prerender_bypass=forged' },
      })
      expect(forged.status(), 'a forged draft cookie shows nothing').toBe(404)

      // Signed-in staff: redirected to the post's own URL, draft visible, framing same-origin only.
      const res = await page.goto(entry)
      expect(new URL(page.url()).pathname).toBe(`/${doc.postNumber}/`)
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
      await expect(page.getByText('Preview — unpublished changes are visible')).toBeVisible()
      const headers = res!.headers()
      expect(headers['content-security-policy']).toContain("frame-ancestors 'self'")
      expect(headers['x-frame-options']).toBe('SAMEORIGIN')
      expect(headers['x-robots-tag']).toContain('noindex')

      // The real draft cookie WITHOUT the admin session still shows nothing.
      const bypass = (await page.context().cookies()).find((c) => c.name === '__prerender_bypass')
      expect(bypass).toBeTruthy()
      const stolen = await request.get(`/${doc.postNumber}/`, {
        maxRedirects: 0,
        headers: { cookie: `__prerender_bypass=${bypass!.value}` },
      })
      expect(stolen.status(), 'draft cookie alone is not enough').toBe(404)

      // Side-by-side live preview in the editor: an edit shows up in the iframe after autosave.
      await page.goto(`/admin/collections/posts/${doc.id}`)
      await page.locator('#live-preview-toggler').click()
      const frame = page.frameLocator('#live-preview-iframe')
      await expect(frame.getByRole('heading', { level: 1, name: title })).toBeVisible()
      const edited = `${title} edited`
      await page.locator('#field-title').fill(edited)
      await expect(frame.getByRole('heading', { level: 1, name: edited })).toBeVisible({
        timeout: 30_000,
      })
      await page.screenshot({ path: `${SHOTS}/admin-live-preview.png`, ...SHOT })
      await page.locator('#live-preview-toggler').click()

      // Leaving preview: the draft is gone again for this browser too.
      await page.goto(`/next/exit-preview/?path=/${doc.postNumber}/`)
      expect(new URL(page.url()).pathname).toBe(`/${doc.postNumber}/`)
      await expect(page.getByText('Preview — unpublished changes are visible')).toHaveCount(0)
      for (const bad of [
        '//attacker.invalid/',
        '/.//attacker.invalid',
        '/a/..//attacker.invalid',
      ]) {
        const exit = await request.get(`/next/exit-preview/?path=${encodeURIComponent(bad)}`, {
          maxRedirects: 0,
        })
        expect(exit.headers()['location'], bad).toBe('/')
      }
    } finally {
      expect((await call(page, `/api/posts/${doc.id}`, { method: 'DELETE' })).status).toBe(200)
    }
  })

  expect(
    consoleErrors.filter((e) => /Content Security Policy|Refused to/.test(e)),
    'no CSP violations in the admin',
  ).toEqual([])
  // The browser logs every non-2xx fetch; the 400/403s are refusals this test provokes on purpose and
  // the 404 is the draft post page after leaving preview.
  const deliberate = /^Failed to load resource: the server responded with a status of 40[034] /
  expect(
    consoleErrors.filter((e) => !deliberate.test(e)),
    'no unexpected console errors in the admin',
  ).toEqual([])
})
