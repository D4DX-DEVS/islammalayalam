import { defineConfig } from '@playwright/test'

/**
 * E2E against the local dev server (port 3444). Three viewports, Chromium.
 * Traces/videos stay OFF: the admin spec types credentials, which must never land in an artifact.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3444'
/** E2E never touches live data: the dev server it starts uses the local seed database + local media. */
const LOCAL_SEED_ENV = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/islammalayalam_dev',
  DO_SPACES_BUCKET: '',
  DO_SPACES_ENDPOINT: '',
  DO_SPACES_KEY: '',
  DO_SPACES_SECRET: '',
  DO_SPACES_CDN_ENDPOINT: '',
  DO_SPACES_FOLDER: '',
}

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
    // Never reuse a running `npm run dev`: that one reads the live MONGODB_URI from .env.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...(process.env as Record<string, string>),
      ...LOCAL_SEED_ENV,
      NEXT_PUBLIC_SERVER_URL: baseURL,
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
