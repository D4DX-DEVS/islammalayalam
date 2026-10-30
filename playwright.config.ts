import { defineConfig } from '@playwright/test'

/**
 * E2E against its own dev server on port 3555 (so it can run beside `npm run dev` on 3444). Three
 * viewports, Chromium. Traces/videos stay OFF: the admin spec types credentials, which must never
 * land in an artifact.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3555'
const port = new URL(baseURL).port || '80'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: { baseURL, trace: 'off', video: 'off', screenshot: 'only-on-failure', locale: 'ml-IN' },
  webServer: {
    // scripts/dev/local.mjs pins the local seed database and local media, never the live data.
    command: `node scripts/dev/local.mjs next dev -p ${port}`,
    url: baseURL,
    // Never reuse a server someone else started: it may be `npm run dev:live` on the live data.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...(process.env as Record<string, string>),
      NEXT_PUBLIC_SERVER_URL: baseURL,
      // Its own build folder (next.config.ts), so it can run beside another dev server.
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
  // Layout specs run at every width; header/API/admin specs are viewport-independent and run once.
  projects: [
    {
      name: 'mobile-375',
      testMatch: 'public.spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-768',
      testMatch: 'public.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],
})
