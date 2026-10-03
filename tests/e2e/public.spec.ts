import { expect, test, type Page } from '@playwright/test'

const KB = `/${encodeURIComponent('ആദർശം')}/${encodeURIComponent('വിശ്വാസം')}/`
const LEGACY_KB = `/${encodeURIComponent('ആദര്‍ശം')}/` // exactly how WordPress linked it
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280
/** Menu labels keep the original WordPress spelling (legacy chillu ര്‍ = ര + virama + ZWJ); URLs use the atomic form. */
const ADARSHAM = /^ആദ(?:ർ|ര്‍)ശം/

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, 'page must never scroll sideways').toBeLessThanOrEqual(clientWidth)
}

async function brokenImages(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
  await page.waitForLoadState('networkidle')
  return page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src),
  )
}

test('home: all sections render, images load, no errors, no sideways scroll', async ({ page }) => {
  const errors = await collectErrors(page)
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)
  await expect(page.locator('h1')).toHaveCount(1)
  for (const label of ['സമകാലികം', 'ചോദ്യോത്തരം', 'Videos', 'ലേഖനം', 'Audios', 'E-Books']) {
    await expect(page.getByRole('heading', { name: label, exact: true }).first()).toBeVisible()
  }
  await noHorizontalOverflow(page)
  expect(await brokenImages(page)).toEqual([])
  expect(errors).toEqual([])
})

test('branding: the site’s own logo in header and footer; favicon, app icons and manifest', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const headerLogo = page.locator('header a[href="/"] img:visible').first()
  await expect(headerLogo).toHaveAttribute('alt', /Islam Malayalam/)
  expect(await headerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(await headerLogo.getAttribute('src')).toContain('brand%2Flogo')
  const footerLogo = page.locator('footer a[href="/"] img').first()
  expect(await footerLogo.getAttribute('src')).toContain('brand%2Flogo-mobile') // white lettering
  const icons = page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
  const hrefs = (
    await icons.evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''))
  ).map((href) => href.split('?')[0])
  expect(hrefs.length).toBeGreaterThanOrEqual(3)
  expect(new Set(hrefs).size, 'no icon declared twice').toBe(hrefs.length)
  // The dark-mode logo stays unfetched in light mode: nothing preloads both.
  expect(await page.locator('head link[rel="preload"][imagesrcset*="brand"]').count()).toBe(0)

  for (const [path, type] of [
    ['/favicon.ico', /image\/(x-icon|vnd\.microsoft\.icon)/],
    ['/brand/icon-192.png', /image\/png/],
    ['/brand/icon-512.png', /image\/png/],
    ['/brand/apple-touch-icon.png', /image\/png/],
    ['/brand/icon-maskable-512.png', /image\/png/],
    ['/brand/logo.png', /image\/png/],
  ] as const) {
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(200)
    expect(res.headers()['content-type'], path).toMatch(type)
  }
  const manifest = await request.get('/manifest.webmanifest', { maxRedirects: 0 })
  expect(manifest.status()).toBe(200)
  const { icons: listed } = (await manifest.json()) as {
    icons: Array<{ src: string; purpose?: string }>
  }
  expect(listed.length).toBeGreaterThanOrEqual(2)
  expect(listed.find((i) => i.purpose === 'maskable')?.src).toBe('/brand/icon-maskable-512.png')
})

test('navigation: desktop dropdowns / mobile drawer', async ({ page }) => {
  await page.goto('/')
  if (isDesktop(page)) {
    const nav = page.getByRole('navigation', { name: 'പ്രധാന മെനു' })
    await nav.getByRole('link', { name: ADARSHAM }).hover()
    await expect(nav.getByRole('link', { name: 'വിശ്വാസം', exact: true })).toBeVisible()
    const row = await nav
      .locator('ul')
      .first()
      .evaluate((ul) => {
        const items = [...ul.children].map((li) => li.getBoundingClientRect())
        return {
          tops: new Set(items.map((r) => Math.round(r.top))).size,
          heights: new Set(items.map((r) => Math.round(r.height))).size,
          right: Math.max(...items.map((r) => r.right)),
        }
      })
    expect(row.tops, 'all top-level menus on one row').toBe(1)
    expect(row.heights, 'no menu label wraps onto two lines').toBe(1)
    expect(row.right, 'menu fits inside the viewport').toBeLessThanOrEqual(
      page.viewportSize()!.width,
    )
  } else {
    await page.evaluate(() => window.scrollTo(0, 600)) // open it mid-page, under the sticky header
    await page.getByRole('button', { name: 'മെനു', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'മെനു' })
    await expect(drawer).toBeVisible()
    // Full-height panel on top of the page (a backdrop-blur ancestor once squeezed it into the header).
    const layout = await drawer.evaluate((panel) => {
      const r = panel.getBoundingClientRect()
      const probes = [0.25, 0.5, 0.85].map((f) =>
        panel.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height * f)),
      )
      return { top: r.top, height: r.height, onTop: probes.every(Boolean) }
    })
    expect(layout.top).toBe(0)
    expect(layout.height, 'drawer fills the screen height').toBe(page.viewportSize()!.height)
    expect(layout.onTop, 'nothing from the page covers the drawer').toBe(true)
    await drawer.getByRole('button', { name: new RegExp(`${ADARSHAM.source} — ഉപമെനു$`) }).click()
    await expect(drawer.getByRole('link', { name: 'വിശ്വാസം', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('button', { name: 'മെനു', exact: true })).toBeFocused()
  }
})

test('article: /<number>/ permalink renders with breadcrumbs and related posts', async ({
  page,
}) => {
  const res = await page.goto('/900001/')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('മാതൃകാ ലേഖനം')
  await expect(page.getByRole('navigation', { name: 'ബ്രെഡ്ക്രംബ്' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ബന്ധപ്പെട്ടവ' })).toBeVisible()
  await noHorizontalOverflow(page)
})

test('KB page: tabs are keyboard operable', async ({ page }) => {
  await page.goto(KB)
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveCount(2)
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toBeVisible()
  await noHorizontalOverflow(page)
})

test('category archive renders a grid', async ({ page }) => {
  const res = await page.goto('/category/news/')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'സമകാലികം' })).toBeVisible()
  await expect(page.locator('main li h2')).toHaveCount(6)
  await noHorizontalOverflow(page)
})

test.describe('URL preservation (HTTP status codes, not meta refresh)', () => {
  test('legacy chillu spelling → single permanent redirect to the canonical URL', async ({
    request,
  }) => {
    const res = await request.get(LEGACY_KB, { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    expect(res.headers().location).toBe(`/${encodeURIComponent('ആദർശം')}/`)
  })

  test('missing trailing slash → 308 to the WordPress-style URL', async ({ request }) => {
    const res = await request.get('/900001', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    expect(new URL(res.headers().location!, 'http://x').pathname).toBe('/900001/')
  })

  test('unknown pages return a real 404', async ({ request }) => {
    for (const path of [
      '/no-such-page/',
      '/999999999/',
      '/category/no-such-category/',
      '/author/nobody/',
    ]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404)
    }
  })
})

test.describe('search', () => {
  const LEGACY_QURAN = encodeURIComponent('ഖുര്‍ആന്‍') // ഖുര്‍ആന്‍ (legacy chillu)
  const ATOMIC_QURAN = encodeURIComponent('ഖുർആൻ') // ഖുർആൻ (atomic chillu)

  test('finds pages whichever chillu spelling is typed, and is not indexed', async ({ page }) => {
    for (const q of [LEGACY_QURAN, ATOMIC_QURAN]) {
      const res = await page.goto(`/search/?q=${q}`)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole('heading', { name: 'പേജുകൾ' })).toBeVisible()
      expect(await page.locator('#page-hits + ul li').count()).toBeGreaterThan(0)
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await noHorizontalOverflow(page)
  })

  test('the header search box submits to the search page', async ({ page }) => {
    await page.goto(isDesktop(page) || (page.viewportSize()?.width ?? 0) >= 768 ? '/' : '/search/')
    const box = page.getByRole('searchbox').first()
    await box.fill('ലേഖനം')
    await box.press('Enter')
    await expect(page).toHaveURL(/\/search\/\?q=/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ലേഖനം')
    expect(await page.locator('main li h2').count()).toBeGreaterThan(0)
  })

  test('old WordPress search links redirect permanently', async ({ request }) => {
    const res = await request.get('/?s=test', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    expect(res.headers().location).toMatch(/\/search\/\?q=test$/)
  })
})

test('theme toggle switches to dark and the choice survives a reload', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  await page.getByRole('button', { name: 'ഇരുണ്ട / തെളിഞ്ഞ മോഡ്' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark') // server-rendered from the cookie: no flash
  await page.getByRole('button', { name: 'ഇരുണ്ട / തെളിഞ്ഞ മോഡ്' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})
