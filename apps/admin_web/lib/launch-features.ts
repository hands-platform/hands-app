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
