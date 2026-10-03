import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/** Next 16 ships native flat configs (the FlatCompat bridge from the Payload template no longer loads them). */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // Project rule: one responsibility per file, split before a file grows past ~500 lines.
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'migration/**/*.ts'],
    ignores: ['src/payload-types.ts'],
    rules: { 'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }] },
  },
  globalIgnores([
    '.next/**',
    '.logs/**',
    'media/**',
    '.test-media/**',
    'test-results/**',
    'playwright-report/**',
    'src/payload-types.ts',
    'src/payload-generated-schema.ts',
    'src/app/(payload)/admin/importMap.js',
  ]),
])
