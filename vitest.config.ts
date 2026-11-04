import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'apps/app/src/**/*.test.ts', 'tests/util/**/*.test.mjs'],
  },
})
