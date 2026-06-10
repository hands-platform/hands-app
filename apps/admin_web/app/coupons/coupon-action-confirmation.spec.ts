import type { AdminCoupon } from '../../lib/admin-api';
import { buildCouponToggleConfirmation, couponToggleConfirmHref } from './coupon-action-confirmation';

const activeCoupon = {
  id: 'coupon-active',
  code: 'WELCOME10',
  active: true,
  discount: { type: 'percent', value: 10 },
} as AdminCoupon;

const pausedCoupon = {
  id: 'coupon-paused',
  code: 'BACK20',
  active: false,
  discount: { type: 'percent', value: 20 },
} as AdminCoupon;

describe('coupon action confirmation', () => {
  it('builds a destructive pause confirmation when the coupon is active', () => {
    const confirmation = buildCouponToggleConfirmation([activeCoupon], activeCoupon.id);

    expect(confirmation).toEqual({
      cancelHref: '/coupons',
      confirmLabel: 'Pause coupon',
      couponId: activeCoupon.id,
      currentActive: true,
      description:
        'Pause WELCOME10. Customers will stop using this code in checkout after the change is saved.',
      title: 'Pause WELCOME10?',
      tone: 'danger',
    });
  });

  it('builds an activate confirmation when the coupon is paused', () => {
    const confirmation = buildCouponToggleConfirmation([pausedCoupon], pausedCoupon.id);

    expect(confirmation).toEqual({
      cancelHref: '/coupons',
      confirmLabel: 'Activate coupon',
      couponId: pausedCoupon.id,
      currentActive: false,
      description: 'Activate BACK20. Customers may use this code in checkout when its date window is valid.',
      title: 'Activate BACK20?',
      tone: 'warning',
    });
  });

  it('returns null when the coupon id is not loaded', () => {
    expect(buildCouponToggleConfirmation([activeCoupon], 'missing')).toBeNull();
  });

  it('encodes the confirmation URL', () => {
    expect(couponToggleConfirmHref('coupon 1')).toBe('/coupons?confirm=toggle&couponId=coupon%201');
  });
});
