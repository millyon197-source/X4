import { defineConfig } from 'vitest/config';

// Test-only config; the app build keeps using vite.config.js.
export default defineConfig({
  define: { __IS_HOSTED__: false },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
