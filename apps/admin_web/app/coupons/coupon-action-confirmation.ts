import type { AdminCoupon } from '../../lib/admin-api';
import type { StatusBadgeTone } from '../../components/status-badge';
import { formatCouponIctDateTime } from './coupon-ict-time';

export type CouponToggleConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly couponId: string;
  readonly currentActive: boolean;
  readonly description: string;
  readonly disabled: boolean;
  readonly supportingHref?: string;
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

export function couponToggleConfirmHref(couponId: string, returnTo = '/coupons') {
  const params = new URLSearchParams({ confirm: 'toggle', couponId, returnTo });
  return `/coupons?${params.toString()}`;
}

export function couponDeleteConfirmHref(couponId: string, returnTo = '/coupons') {
  const params = new URLSearchParams({ confirm: 'delete', couponId, returnTo });
  return `/coupons?${params.toString()}`;
}

export function buildCouponToggleConfirmation(
  coupons: readonly AdminCoupon[],
  couponId: string,
  returnTo = '/coupons',
): CouponToggleConfirmation | null {
  const coupon = coupons.find((item) => item.id === couponId);
  if (!coupon) {
    return null;
  }

  const actionLabel = coupon.active ? 'Pause' : 'Activate';
  const expired = !coupon.active && Boolean(coupon.endsAt && Date.parse(coupon.endsAt) < Date.now());
  const exposure = coupon.active
    ? 'Customers will stop using this code in checkout after the change is saved.'
    : 'Customers may use this code in checkout when its date window is valid.';
  const window = `Discount ${couponDiscountLabel(coupon)}. Starts ${formatCouponIctDateTime(
    coupon.startsAt,
    'immediately',
  )}. Ends ${formatCouponIctDateTime(coupon.endsAt, 'with no end date')}.`;

  return {
    cancelHref: returnTo,
    confirmLabel: expired ? 'Activation unavailable' : `${actionLabel} coupon`,
    couponId: coupon.id,
    currentActive: coupon.active,
    description: expired
      ? `${coupon.code} ended at ${formatCouponIctDateTime(coupon.endsAt)}. Update end time before activation. ${window}`
      : `${actionLabel} ${coupon.code}. ${window} ${exposure}`,
    disabled: expired,
    supportingHref: expired ? couponEditHref(returnTo, coupon.id) : undefined,
    title: `${actionLabel} ${coupon.code}?`,
    tone: coupon.active ? 'danger' : 'warning',
  };
}

export function buildCouponDeleteConfirmation(
  coupons: readonly AdminCoupon[],
  couponId: string,
  returnTo = '/coupons',
): CouponDeleteConfirmation | null {
  const coupon = coupons.find((item) => item.id === couponId);
  if (!coupon) {
    return null;
  }

  return {
    cancelHref: returnTo,
    confirmLabel: 'Delete coupon',
    couponId: coupon.id,
    description: `Delete ${coupon.code} (${couponDiscountLabel(coupon)}; ${formatCouponIctDateTime(
      coupon.startsAt,
      'starts immediately',
    )} to ${formatCouponIctDateTime(coupon.endsAt, 'no end date')}). Used coupons cannot be deleted and must remain for audit.`,
    title: `Delete ${coupon.code}?`,
    tone: 'danger',
  };
}

function couponEditHref(returnTo: string, couponId: string) {
  const parsed = new URL(returnTo, 'https://admin.hands.vn');
  parsed.searchParams.set('editCouponId', couponId);
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

function couponDiscountLabel(coupon: AdminCoupon) {
  const discount = coupon.discount && typeof coupon.discount === 'object' && !Array.isArray(coupon.discount)
    ? coupon.discount as Record<string, unknown>
    : null;
  const value = Number(discount?.value);
  return discount?.type === 'percent' && Number.isFinite(value) ? `${value}% off` : 'discount unavailable';
}
