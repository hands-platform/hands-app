import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminCoupon } from '../../lib/admin-api';
import { couponToggleConfirmHref } from './coupon-action-confirmation';

export function couponActionMenuItems(coupon: AdminCoupon): readonly ActionMenuItem[] {
  return [
    {
      description: coupon.active
        ? 'Review before removing this code from checkout.'
        : 'Review before making this code available to checkout.',
      href: couponToggleConfirmHref(coupon.id),
      kind: 'link',
      label: coupon.active ? 'Pause' : 'Activate',
      tone: coupon.active ? 'danger' : 'warning',
    },
  ];
}

export function formatDiscount(discount: unknown): string {
  const input = readRecord(discount);
  if (!input) {
    return 'Unknown';
  }

  const value = readNumber(input.value);
  if (input.type === 'percent' && value !== null) {
    return `${value}% off`;
  }

  return JSON.stringify(discount);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
