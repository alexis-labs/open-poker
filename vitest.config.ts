import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/game/**/*.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
        branches: 70,
      },
    },
  },
});
