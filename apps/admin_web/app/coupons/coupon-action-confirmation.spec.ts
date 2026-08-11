import type { AdminCoupon } from '../../lib/admin-api';
import {
  buildCouponDeleteConfirmation,
  buildCouponToggleConfirmation,
  couponToggleConfirmHref,
} from './coupon-action-confirmation';

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
  it('shows discount, ICT window, exposure, and preserved return context before pause', () => {
    const confirmation = buildCouponToggleConfirmation(
      [activeCoupon],
      activeCoupon.id,
      '/coupons?view=live&couponPage=2',
    );

    expect(confirmation).toMatchObject({
      cancelHref: '/coupons?view=live&couponPage=2',
      confirmLabel: 'Pause coupon',
      couponId: activeCoupon.id,
      currentActive: true,
      disabled: false,
      description: expect.stringContaining('Discount 10% off'),
      title: 'Pause WELCOME10?',
      tone: 'danger',
    });
    expect(confirmation?.description).toContain('Customers will stop using this code');
  });

  it('shows an explicit activate confirmation when the coupon is paused', () => {
    expect(buildCouponToggleConfirmation([pausedCoupon], pausedCoupon.id)).toMatchObject({
      confirmLabel: 'Activate coupon',
      currentActive: false,
      disabled: false,
      description: expect.stringContaining('Customers may use this code'),
      title: 'Activate BACK20?',
      tone: 'warning',
    });
  });

  it('disables expired activation and links to the ICT window editor', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-10T00:00:00.000Z'));
    const confirmation = buildCouponToggleConfirmation([
      { ...pausedCoupon, endsAt: '2026-06-09T00:00:00.000Z' },
    ], pausedCoupon.id, '/coupons?view=records');

    expect(confirmation).toMatchObject({
      confirmLabel: 'Activation unavailable',
      disabled: true,
      supportingHref: '/coupons?view=records&editCouponId=coupon-paused',
    });
    vi.restoreAllMocks();
  });

  it('returns null when the independently loaded coupon id does not match', () => {
    expect(buildCouponToggleConfirmation([activeCoupon], 'missing')).toBeNull();
  });

  it('keeps audit retention explicit before delete confirmation', () => {
    expect(buildCouponDeleteConfirmation([activeCoupon], activeCoupon.id)).toMatchObject({
      description: expect.stringContaining('Used coupons cannot be deleted and must remain for audit.'),
      title: 'Delete WELCOME10?',
    });
  });

  it('encodes the confirmation URL and its return context', () => {
    expect(couponToggleConfirmHref('coupon 1', '/coupons?view=records')).toBe(
      '/coupons?confirm=toggle&couponId=coupon+1&returnTo=%2Fcoupons%3Fview%3Drecords',
    );
  });
});
