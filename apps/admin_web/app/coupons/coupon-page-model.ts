import type { AdminCoupon } from '../../lib/admin-api';
import { formatDateTime as formatDate } from '../../lib/admin-format';
import type { CouponTableRow } from './coupons-table-section';
import { couponActionMenuItems, formatDiscount } from './coupon-page-presenters';

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

export function buildCouponPageModel(coupons: readonly AdminCoupon[]): CouponPageModel {
  const orderedCoupons = sortCoupons(coupons);
  const liveCoupons = orderedCoupons.filter((coupon) => coupon.active && couponWindowState(coupon) === 'live');
  const activeCoupons = orderedCoupons.filter((coupon) => coupon.active && couponWindowState(coupon) !== 'expired');
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
    actions: couponActionMenuItems(coupon),
    checkoutHint: couponCheckoutHint(coupon),
    code: coupon.code,
    description: coupon.description ?? '-',
    discountLabel: formatDiscount(coupon.discount),
    id: coupon.id,
    lowerCode: coupon.code.toLowerCase(),
    opsHint: couponOpsHint(coupon),
    statusClassName: couponStatusClass(coupon),
    statusLabel: couponStatusLabel(coupon),
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
      detail: 'Paused campaigns and review candidates need a deliberate activate, replace, or cleanup decision.',
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
  const start = coupon.startsAt ? formatDate(coupon.startsAt) : 'Immediate';
  const end = coupon.endsAt ? formatDate(coupon.endsAt) : 'No end date';
  return `${start} -> ${end}`;
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
  return 'Safe to use in customer checkout now.';
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
  return 'Checkout preview and booking payment authorization should apply this discount.';
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
