import { ServiceUnavailableException } from '@nestjs/common';

export function couponLaunchEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.COUPON_LAUNCH_ENABLED === 'true';
}

export function shiftHandoffLaunchEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.SHIFT_HANDOFF_LAUNCH_ENABLED === 'true';
}

export function cmsDestructiveLifecycleEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return env.CMS_DESTRUCTIVE_LIFECYCLE_ENABLED === 'true';
}

export function assertCouponLaunchEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (!couponLaunchEnabled(env)) {
    throw new ServiceUnavailableException('Coupons are not active for the current launch');
  }
}

export function assertShiftHandoffLaunchEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!shiftHandoffLaunchEnabled(env)) {
    throw new ServiceUnavailableException('Shift Handoff is not active for the current launch');
  }
}

export function assertCmsDestructiveLifecycleEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!cmsDestructiveLifecycleEnabled(env)) {
    throw new ServiceUnavailableException(
      'CMS destructive lifecycle is manual-only for the current launch',
    );
  }
}
