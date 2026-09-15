import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: that config carries the PWA and Sentry
// plugins, which have no business running during a test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.js', 'src/**/*.test.ts'],

    // mongodb-memory-server downloads a MongoDB binary the first time it runs
    // and starts a server per suite, so the default 5s timeout is too tight.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
