import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Source tests only — `tsc` builds into dist/ (including compiled test
    // files), and vitest's default glob would pick those stale CommonJS
    // copies up as broken suites.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
