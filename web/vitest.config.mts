import { defineConfig } from 'vitest/config';

// Dates render in the browser's time zone: pin the agencies' so tests don't depend on the machine's.
process.env.TZ = 'Africa/Tunis';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [ 'test/**/*.test.{ts,tsx}' ],
    setupFiles: [ 'test/setup.ts' ],
    testTimeout: 60000,
    // Node 25's own `localStorage` would hide jsdom's.
    execArgv: [ '--no-experimental-webstorage' ],
  },
});
