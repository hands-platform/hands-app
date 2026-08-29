import type { AdminCoupon } from '../../lib/admin-api';
import { formatMoney, shortDisplayId } from '../../lib/admin-format';
import type { CouponTableRow } from './coupons-table-section';
import { couponIsoToIctWallTimeInput, formatCouponIctDateTime } from './coupon-ict-time';
import { formatDiscount } from './coupon-page-presenters';

export type CampaignCommandTone = 'warn' | 'info' | 'ok';
export type CouponWindowState = 'draft' | 'scheduled' | 'live' | 'expired';

export type CampaignCommandItem = {
  readonly coupons: readonly AdminCoupon[];
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: CampaignCommandTone;
};

export type CouponCreateNotice = {
  readonly detail: string;
  readonly title: string;
  readonly tone: 'danger' | 'success' | 'warning';
};

export type CouponPageModel = {
  readonly activeCoupons: readonly AdminCoupon[];
  readonly campaignBoard: readonly CampaignCommandItem[];
  readonly couponRows: readonly CouponTableRow[];
  readonly expiredCoupons: readonly AdminCoupon[];
  readonly liveCoupons: readonly AdminCoupon[];
  readonly needsReview: readonly AdminCoupon[];
  readonly orderedCoupons: readonly AdminCoupon[];
  readonly pausedCoupons: readonly AdminCoupon[];
  readonly scheduledCoupons: readonly AdminCoupon[];
};

export function buildCouponCreateNotice({
  created,
  failed,
  notice,
}: {
  readonly created?: string;
  readonly failed?: string;
  readonly notice?: string;
}): CouponCreateNotice | null {
  const createdCount = readInteger(created);
  const failedCount = readInteger(failed);

  if (notice === 'missing-required') {
    return {
      detail: 'Enter at least one coupon code and a discount percent greater than zero.',
      title: 'Coupon was not created',
      tone: 'danger',
    };
  }

  if (notice === 'date-order') {
    return {
      detail: 'The start date must be before the end date.',
      title: 'Coupon date window is invalid',
      tone: 'danger',
    };
  }

  if (notice === 'invalid-date') {
    return {
      detail: 'Choose valid start and end date values before saving the coupon.',
      title: 'Coupon date value is invalid',
      tone: 'danger',
    };
  }

  if (notice === 'created') {
    return {
      detail: `${createdCount || 1} coupon(s) are now available in the coupon list.`,
      title: 'Coupon created',
      tone: 'success',
    };
  }

  if (notice === 'partial') {
    return {
      detail: `${createdCount} coupon(s) were created. ${failedCount} code(s) were skipped, usually because the code already exists or the API rejected it.`,
      title: 'Some coupons need attention',
      tone: 'warning',
    };
  }

  if (notice === 'failed') {
    return {
      detail: 'No coupon was saved. Check for duplicate codes and try again.',
      title: 'Coupon creation failed',
      tone: 'danger',
    };
  }

  if (notice === 'admin-auth') {
    return {
      detail: 'Your Admin session is missing, expired, or unauthorized. Sign in again before saving coupon changes.',
      title: 'Admin session expired',
      tone: 'danger',
    };
  }

  if (notice === 'updated') {
    return {
      detail: 'The coupon settings were saved and the list was refreshed.',
      title: 'Coupon updated',
      tone: 'success',
    };
  }

  if (notice === 'update-missing') {
    return {
      detail: 'Choose a valid coupon and enter a discount percent greater than zero.',
      title: 'Coupon update was not saved',
      tone: 'danger',
    };
  }

  if (notice === 'update-failed') {
    return {
      detail: 'The API did not save the coupon update. Check the values and try again.',
      title: 'Coupon update failed',
      tone: 'danger',
    };
  }

  if (notice === 'toggled') {
    return {
      detail: 'The coupon availability was changed and the list was refreshed.',
      title: 'Coupon status updated',
      tone: 'success',
    };
  }

  if (notice === 'state-reason-required') {
    return {
      detail: 'Enter a non-blank operational reason before changing coupon availability.',
      title: 'Coupon status was not changed',
      tone: 'danger',
    };
  }

  if (notice === 'state-conflict') {
    return {
      detail: 'The coupon already has the requested status. Refresh before making another change.',
      title: 'Coupon status already changed',
      tone: 'warning',
    };
  }

  if (notice === 'activate-expired') {
    return {
      detail: 'Update the ICT end time before activating this coupon.',
      title: 'Expired coupon cannot be activated',
      tone: 'warning',
    };
  }

  if (notice === 'deleted') {
    return {
      detail: 'The coupon was removed from the coupon list.',
      title: 'Coupon deleted',
      tone: 'success',
    };
  }

  if (notice === 'delete-missing') {
    return {
      detail: 'Choose a coupon before deleting it.',
      title: 'Coupon deletion was not started',
      tone: 'danger',
    };
  }

  if (notice === 'delete-failed') {
    return {
      detail: 'The API did not delete the coupon. It may have already been removed.',
      title: 'Coupon deletion failed',
      tone: 'danger',
    };
  }

  if (notice === 'delete-used') {
    return {
      detail: 'This coupon has booking usage and must remain available for audit. Pause it instead of deleting it.',
      title: 'Used coupon cannot be deleted',
      tone: 'warning',
    };
  }

  return null;
}

export function buildCouponPageModel(coupons: readonly AdminCoupon[]): CouponPageModel {
  const orderedCoupons = sortCoupons(coupons);
  const liveCoupons = orderedCoupons.filter(
    (coupon) => coupon.active && couponWindowState(coupon) === 'live',
  );
  const activeCoupons = orderedCoupons.filter(
    (coupon) => coupon.active && couponWindowState(coupon) !== 'expired',
  );
  const scheduledCoupons = orderedCoupons.filter(
    (coupon) => coupon.active && couponWindowState(coupon) === 'scheduled',
  );
  const expiredCoupons = orderedCoupons.filter((coupon) => couponWindowState(coupon) === 'expired');
  const pausedCoupons = orderedCoupons.filter((coupon) => !coupon.active);
  const needsReview = orderedCoupons.filter((coupon) => couponNeedsReview(coupon));

  return {
    activeCoupons,
    campaignBoard: buildCampaignCommandBoard({
      liveCoupons,
      scheduledCoupons,
      expiredCoupons,
      pausedCoupons,
      needsReview,
    }),
    couponRows: buildCouponTableRows(orderedCoupons),
    expiredCoupons,
    liveCoupons,
    needsReview,
    orderedCoupons,
    pausedCoupons,
    scheduledCoupons,
  };
}

export function sortCoupons(coupons: readonly AdminCoupon[]): AdminCoupon[] {
  return [...coupons].sort((left, right) => couponPriority(right) - couponPriority(left));
}

export function buildCouponTableRows(coupons: readonly AdminCoupon[]): CouponTableRow[] {
  return coupons.map((coupon) => ({
    active: coupon.active,
    checkoutHint: couponCheckoutHint(coupon),
    code: coupon.code,
    description: coupon.description ?? '-',
    discountLabel: formatDiscount(coupon.discount),
    endsAtIso: coupon.endsAt ?? '',
    id: coupon.id,
    lowerCode: coupon.code.toLowerCase(),
    opsHint: couponOpsHint(coupon),
    percentValue: couponPercentValue(coupon.discount),
    startsAtInputValue: couponIsoToIctWallTimeInput(coupon.startsAt),
    startsAtIso: coupon.startsAt ?? '',
    statusClassName: couponStatusClass(coupon),
    statusLabel: couponStatusLabel(coupon),
    endsAtInputValue: couponIsoToIctWallTimeInput(coupon.endsAt),
    usageBookingCount: coupon.usageBookingCount ?? coupon.usageBookings?.length ?? 0,
    usageBookings: (coupon.usageBookings ?? []).map((booking) => ({
      amount: booking.amount ?? null,
      bookingHref: `/bookings/${booking.bookingId}`,
      bookingLabel: shortDisplayId(booking.bookingId),
      currency: booking.currency ?? 'VND',
      customerLabel: booking.customerName ?? booking.customerPhone ?? 'Unknown customer',
      discountAmount: booking.discountAmount ?? null,
      discountLabel: formatMoney(booking.discountAmount, booking.currency ?? 'VND', '-'),
      partnerLabel: booking.partnerName ?? 'Not matched',
      paymentLabel: [booking.paymentMethod, booking.paymentStatus].filter(Boolean).join(' / ') || 'No payment',
      requestTimeLabel: formatCouponIctDateTime(booking.requestTime, 'Not set'),
      reversalStatusLabel: booking.reversalStatus ?? 'ACTIVE',
      serviceLabel: booking.serviceName ?? '-',
      statusLabel: booking.status ?? '-',
    })),
    usageCountKnown: coupon.usageBookingCount !== undefined,
    windowState: couponWindowState(coupon),
    windowLabel: couponWindowLabel(coupon),
    windowSignal: couponWindowSignal(coupon),
  }));
}

export function buildCampaignCommandBoard({
  liveCoupons,
  scheduledCoupons,
  expiredCoupons,
  pausedCoupons,
  needsReview,
}: {
  readonly expiredCoupons: readonly AdminCoupon[];
  readonly liveCoupons: readonly AdminCoupon[];
  readonly needsReview: readonly AdminCoupon[];
  readonly pausedCoupons: readonly AdminCoupon[];
  readonly scheduledCoupons: readonly AdminCoupon[];
}): CampaignCommandItem[] {
  return [
    {
      title: 'Live checkout codes',
      detail: 'Codes customers can use right now while booking. Monitor discount exposure and booking lift.',
      status: 'Live',
      operatorAction: 'Confirm each live code has an intended campaign owner and end condition.',
      href: '/coupons',
      tone: liveCoupons.length > 0 ? 'info' : 'ok',
      coupons: liveCoupons,
    },
    {
      title: 'Upcoming campaigns',
      detail: 'Scheduled codes should be ready before marketing pushes or partner demand planning.',
      status: 'Scheduled',
      operatorAction: 'Check start time, discount amount, and support briefing before launch.',
      href: '/coupons',
      tone: scheduledCoupons.length > 0 ? 'info' : 'ok',
      coupons: scheduledCoupons,
    },
    {
      title: 'Expired active codes',
      detail: 'Expired codes that remain active create customer confusion and checkout rejection noise.',
      status: 'Expired',
      operatorAction: 'Pause, replace, or archive these before the next campaign review.',
      href: '/coupons',
      tone: expiredCoupons.some((coupon) => coupon.active) ? 'warn' : 'ok',
      coupons: expiredCoupons.filter((coupon) => coupon.active),
    },
    {
      title: 'Paused or review queue',
      detail:
        'Paused campaigns and review candidates need a deliberate activate, replace, or cleanup decision.',
      status: 'Needs decision',
      operatorAction: 'Decide whether each code should return, stay paused, or be replaced.',
      href: '/coupons',
      tone: needsReview.length > 0 || pausedCoupons.length > 0 ? 'warn' : 'ok',
      coupons: needsReview.length > 0 ? needsReview : pausedCoupons,
    },
  ];
}

export function couponNeedsReview(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  return (coupon.active && windowState === 'expired') || !coupon.active;
}

export function couponWindowState(coupon: AdminCoupon): CouponWindowState {
  const now = Date.now();
  const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
  const endsAt = coupon.endsAt ? new Date(coupon.endsAt).getTime() : null;

  if (endsAt && endsAt < now) {
    return 'expired';
  }
  if (startsAt && startsAt > now) {
    return 'scheduled';
  }
  if (!coupon.active) {
    return 'draft';
  }
  return 'live';
}

export function couponStatusLabel(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active) {
    return 'PAUSED';
  }
  if (windowState === 'scheduled') {
    return 'SCHEDULED';
  }
  if (windowState === 'expired') {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function campaignToneClass(tone: CampaignCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

export function campaignToneLabel(tone: CampaignCommandTone) {
  if (tone === 'warn') {
    return 'Needs decision';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}

function couponPriority(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (couponNeedsReview(coupon)) {
    return 6;
  }
  if (coupon.active && windowState === 'live') {
    return 5;
  }
  if (coupon.active && windowState === 'scheduled') {
    return 4;
  }
  if (coupon.active && windowState === 'expired') {
    return 3;
  }
  return 1;
}

function couponWindowSignal(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (windowState === 'scheduled') {
    return 'Waiting for start window.';
  }
  if (windowState === 'expired') {
    return 'Past end date.';
  }
  if (!coupon.active) {
    return 'Paused by admin.';
  }
  return 'Live for booking checkout.';
}

function couponWindowLabel(coupon: AdminCoupon) {
  const start = coupon.startsAt ? formatCouponIctDateTime(coupon.startsAt) : 'Starts immediately';
  const end = coupon.endsAt ? formatCouponIctDateTime(coupon.endsAt) : 'No end date';
  return `${start} · ${end}`;
}

function couponOpsHint(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (windowState === 'expired') {
    return coupon.active ? 'Pause or replace this expired code.' : 'Ready for cleanup or replacement.';
  }
  if (windowState === 'scheduled') {
    return 'Leave active so it goes live on schedule.';
  }
  if (!coupon.active) {
    return 'Re-activate when the campaign should return.';
  }
  return '';
}

function couponCheckoutHint(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active) {
    return 'Checkout preview will reject this code until it is activated.';
  }
  if (windowState === 'scheduled') {
    return 'Checkout preview will reject this code until the start time.';
  }
  if (windowState === 'expired') {
    return 'Checkout preview will reject this code because the end time passed.';
  }
  return 'Available at checkout now.';
}

function couponStatusClass(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active || windowState === 'expired') {
    return 'signal signal-warn';
  }
  if (windowState === 'scheduled') {
    return 'signal signal-info';
  }
  return 'signal signal-ok';
}

function couponPercentValue(discount: unknown) {
  const input = readRecord(discount);
  const value = input ? readNumber(input.value) : null;
  return input?.type === 'percent' && value !== null ? String(value) : '';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function readInteger(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
