import { ServiceUnavailableException } from '@nestjs/common';

import {
  assertCmsDestructiveLifecycleEnabled,
  assertCouponLaunchEnabled,
  assertShiftHandoffLaunchEnabled,
  cmsDestructiveLifecycleEnabled,
  couponLaunchEnabled,
  shiftHandoffLaunchEnabled,
} from './launch-features';

describe('launch features', () => {
  it('keeps Coupons fail-closed unless explicitly enabled', () => {
    expect(couponLaunchEnabled({})).toBe(false);
    expect(() => assertCouponLaunchEnabled({})).toThrow(ServiceUnavailableException);
    expect(() => assertCouponLaunchEnabled({ COUPON_LAUNCH_ENABLED: 'true' })).not.toThrow();
  });

  it('keeps Shift Handoff fail-closed unless explicitly enabled', () => {
    expect(shiftHandoffLaunchEnabled({})).toBe(false);
    expect(() => assertShiftHandoffLaunchEnabled({})).toThrow(ServiceUnavailableException);
    expect(() => assertShiftHandoffLaunchEnabled({ SHIFT_HANDOFF_LAUNCH_ENABLED: 'true' })).not.toThrow();
  });

  it('keeps the CMS destructive lifecycle manual-only unless explicitly enabled', () => {
    expect(cmsDestructiveLifecycleEnabled({})).toBe(false);
    expect(() => assertCmsDestructiveLifecycleEnabled({})).toThrow(
      ServiceUnavailableException,
    );
    expect(() =>
      assertCmsDestructiveLifecycleEnabled({
        CMS_DESTRUCTIVE_LIFECYCLE_ENABLED: 'true',
      }),
    ).not.toThrow();
  });
});
