import {
  cmsDestructiveLifecycleEnabled,
  couponLaunchEnabled,
  shiftHandoffLaunchEnabled,
} from './launch-features';

describe('launch features', () => {
  it('keeps Coupons fail-closed unless explicitly enabled', () => {
    expect(couponLaunchEnabled({})).toBe(false);
    expect(couponLaunchEnabled({ COUPON_LAUNCH_ENABLED: 'false' })).toBe(false);
    expect(couponLaunchEnabled({ COUPON_LAUNCH_ENABLED: 'true' })).toBe(true);
  });

  it('keeps Shift Handoff fail-closed unless explicitly enabled', () => {
    expect(shiftHandoffLaunchEnabled({})).toBe(false);
    expect(shiftHandoffLaunchEnabled({ SHIFT_HANDOFF_LAUNCH_ENABLED: 'false' })).toBe(false);
    expect(shiftHandoffLaunchEnabled({ SHIFT_HANDOFF_LAUNCH_ENABLED: 'true' })).toBe(true);
  });

  it('keeps the CMS destructive lifecycle manual-only unless explicitly enabled', () => {
    expect(cmsDestructiveLifecycleEnabled({})).toBe(false);
    expect(
      cmsDestructiveLifecycleEnabled({ CMS_DESTRUCTIVE_LIFECYCLE_ENABLED: 'false' }),
    ).toBe(false);
    expect(
      cmsDestructiveLifecycleEnabled({ CMS_DESTRUCTIVE_LIFECYCLE_ENABLED: 'true' }),
    ).toBe(true);
  });
});
