import { defineConfig } from '@playwright/test'

/**
 * E2E against the local dev server (port 3444). Three viewports, Chromium.
 * Traces/videos stay OFF: the admin spec types credentials, which must never land in an artifact.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3444'

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
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { ...(process.env as Record<string, string>), NEXT_PUBLIC_SERVER_URL: baseURL },
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
