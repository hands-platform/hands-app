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
    include: ['src/**/*.spec.ts'],
    clearMocks: true,
  },
});
