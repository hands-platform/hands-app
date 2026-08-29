import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      CMS_DESTRUCTIVE_LIFECYCLE_ENABLED: 'true',
      COUPON_LAUNCH_ENABLED: 'true',
      SHIFT_HANDOFF_LAUNCH_ENABLED: 'true',
    },
    globals: true,
    environment: 'node',
    include: ['lib/**/*.spec.ts', 'app/**/*.spec.ts', 'app/**/*.spec.tsx', 'components/**/*.spec.tsx'],
    clearMocks: true,
    // Several policy guards scan the full Admin TSX tree. Keep enough parallelism
    // for page tests without making those guards contend for the same files.
    maxWorkers: 4,
  },
});
