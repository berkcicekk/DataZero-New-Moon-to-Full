import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The circuits under test are real ZK circuits executed by the Compact
    // runtime, so a single assertion can take seconds on a cold cache.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    // Compact's runtime keeps WASM state per process; one fork keeps the
    // contract instances isolated without the overhead of a pool per file.
    pool: 'forks',
  },
});
