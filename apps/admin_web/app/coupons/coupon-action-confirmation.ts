import type { AdminCoupon } from '../../lib/admin-api';
import type { StatusBadgeTone } from '../../components/status-badge';

export type CouponToggleConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly couponId: string;
  readonly currentActive: boolean;
  readonly description: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export type CouponDeleteConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly couponId: string;
  readonly description: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export function couponToggleConfirmHref(couponId: string) {
  return `/coupons?confirm=toggle&couponId=${encodeURIComponent(couponId)}`;
}

export function couponDeleteConfirmHref(couponId: string) {
  return `/coupons?confirm=delete&couponId=${encodeURIComponent(couponId)}`;
}

export function buildCouponToggleConfirmation(
  coupons: readonly AdminCoupon[],
  couponId: string,
): CouponToggleConfirmation | null {
  const coupon = coupons.find((item) => item.id === couponId);
  if (!coupon) {
    return null;
  }

  const actionLabel = coupon.active ? 'Pause' : 'Activate';
  const exposure = coupon.active
    ? 'Customers will stop using this code in checkout after the change is saved.'
    : 'Customers may use this code in checkout when its date window is valid.';

  return {
    cancelHref: '/coupons',
    confirmLabel: `${actionLabel} coupon`,
    couponId: coupon.id,
    currentActive: coupon.active,
    description: `${actionLabel} ${coupon.code}. ${exposure}`,
    title: `${actionLabel} ${coupon.code}?`,
    tone: coupon.active ? 'danger' : 'warning',
  };
}

export function buildCouponDeleteConfirmation(
  coupons: readonly AdminCoupon[],
  couponId: string,
): CouponDeleteConfirmation | null {
  const coupon = coupons.find((item) => item.id === couponId);
  if (!coupon) {
    return null;
  }

  const usageCount = coupon.usageBookings?.length ?? 0;
  const usageWarning =
    usageCount > 0
      ? ` ${usageCount} recent booking usage record(s) will remain visible in booking/payment history, but this code will no longer appear in the coupon manager.`
      : ' No recent booking usage is attached to this coupon.';

  return {
    cancelHref: '/coupons',
    confirmLabel: 'Delete coupon',
    couponId: coupon.id,
    description: `Delete ${coupon.code}.${usageWarning}`,
    title: `Delete ${coupon.code}?`,
    tone: 'danger',
  };
}
