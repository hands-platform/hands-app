import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.spec.ts', 'app/**/*.spec.ts', 'app/**/*.spec.tsx', 'components/**/*.spec.tsx'],
    clearMocks: true,
  },
});
