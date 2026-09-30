import { defineConfig } from 'vitest/config'

// .mts so Vite loads it as ESM, and native tsconfig path resolution so the
// `@/` alias works without a plugin.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['lib/**/*.test.ts'] },
})
