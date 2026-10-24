import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'astro:middleware': fileURLToPath(
        new URL('./tests/unit/stubs/astro-middleware.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/lib/**/*.ts',
        'src/middleware.ts',
        'src/pages/api/**/*.ts',
      ],
      exclude: ['src/lib/types.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 95,
      },
    },
  },
})
