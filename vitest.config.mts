import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * unit — pure functions, no database, no network.
 * int  — Payload Local API against the local `islammalayalam_test` MongoDB (dropped before each
 *        run by tests/int/global-setup.ts). Files run one at a time: they share one database.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.test.ts'],
          globalSetup: ['tests/int/global-setup.ts'],
          setupFiles: ['tests/int/env.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
