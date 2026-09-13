import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    hookTimeout: 60000,
    testTimeout: 20000,
    fileParallelism: false,
  },
});
