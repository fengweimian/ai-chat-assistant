const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.js'],
    testTimeout: 10000,
    globals: true,
    pool: 'forks',
    setupFiles: ['src/__tests__/setup.js'],
  }
});
