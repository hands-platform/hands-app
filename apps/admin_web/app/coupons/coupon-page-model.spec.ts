import type { AdminCoupon } from '../../lib/admin-api';
import {
  buildCampaignCommandBoard,
  buildCouponCreateNotice,
  buildCouponPageModel,
  buildCouponTableRows,
  campaignToneClass,
  campaignToneLabel,
  couponNeedsReview,
  couponStatusLabel,
  couponWindowState,
  sortCoupons,
} from './coupon-page-model';
import { formatDiscount } from './coupon-page-presenters';

const NOW = Date.parse('2026-06-10T09:00:00.000Z');

describe('coupon page model', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies coupon date windows and review state', () => {
    expect(couponWindowState(coupon({ active: true, startsAt: '2026-06-11T09:00:00.000Z' }))).toBe(
      'scheduled',
    );
    expect(couponWindowState(coupon({ active: true, endsAt: '2026-06-09T09:00:00.000Z' }))).toBe('expired');
    expect(couponWindowState(coupon({ active: false }))).toBe('draft');
    expect(couponWindowState(coupon({ active: true }))).toBe('live');
    expect(couponNeedsReview(coupon({ active: false }))).toBe(true);
    expect(couponNeedsReview(coupon({ active: true, endsAt: '2026-06-09T09:00:00.000Z' }))).toBe(true);
  });

  it('sorts coupons by operations priority', () => {
    const rows = sortCoupons([
      coupon({ active: true, code: 'LIVE', id: 'live' }),
      coupon({ active: true, code: 'SCHEDULED', id: 'scheduled', startsAt: '2026-06-11T09:00:00.000Z' }),
      coupon({ active: false, code: 'PAUSED', id: 'paused' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['paused', 'live', 'scheduled']);
  });

  it('builds page model counts and command lanes', () => {
    const model = buildCouponPageModel([
      coupon({ active: true, code: 'LIVE', id: 'live' }),
      coupon({ active: true, code: 'SOON', id: 'soon', startsAt: '2026-06-11T09:00:00.000Z' }),
      coupon({ active: true, code: 'OLD', endsAt: '2026-06-09T09:00:00.000Z', id: 'old' }),
      coupon({ active: false, code: 'PAUSED', id: 'paused' }),
    ]);

    expect(model.liveCoupons).toHaveLength(1);
    expect(model.activeCoupons).toHaveLength(2);
    expect(model.scheduledCoupons).toHaveLength(1);
    expect(model.expiredCoupons).toHaveLength(1);
    expect(model.needsReview).toHaveLength(2);
    expect(model.campaignBoard.map((item) => [item.title, item.coupons.length, item.tone])).toEqual([
      ['Live checkout codes', 1, 'info'],
      ['Upcoming campaigns', 1, 'info'],
      ['Expired active codes', 1, 'warn'],
      ['Paused or review queue', 2, 'warn'],
    ]);
  });

  it('builds coupon table rows with edit defaults and booking usage', () => {
    const rows = buildCouponTableRows([
      coupon({
        active: true,
        code: 'WELCOME10',
        description: 'Welcome campaign',
        discount: { type: 'percent', value: 10 },
        id: 'coupon-row-1',
        usageBookings: [
          {
            amount: 270000,
            bookingId: 'booking-1',
            currency: 'VND',
            customerName: 'Demo Customer',
            discountAmount: 30000,
            partnerName: 'Smoke Partner',
            paymentMethod: 'MOMO',
            paymentStatus: 'REFUNDED',
            requestTime: '2026-06-12T09:00:00.000Z',
            reversalStatus: 'REVERSED',
            serviceName: 'Massage / 60 min',
            status: 'REFUNDED',
          },
        ],
      }),
    ]);

    expect(rows[0]).toMatchObject({
      active: true,
      checkoutHint: 'Available at checkout now.',
      code: 'WELCOME10',
      description: 'Welcome campaign',
      discountLabel: '10% off',
      lowerCode: 'welcome10',
      percentValue: '10',
      statusLabel: 'ACTIVE',
      usageBookings: [
        expect.objectContaining({
          amount: 270_000,
          currency: 'VND',
          bookingHref: '/bookings/booking-1',
          customerLabel: 'Demo Customer',
          discountAmount: 30000,
          discountLabel: '30.000 VND',
          partnerLabel: 'Smoke Partner',
          paymentLabel: 'MOMO / REFUNDED',
          reversalStatusLabel: 'REVERSED',
          statusLabel: 'REFUNDED',
        }),
      ],
      usageCountKnown: false,
    });
  });

  it('keeps status, discount, and tone labels stable', () => {
    expect(couponStatusLabel(coupon({ active: false }))).toBe('PAUSED');
    expect(couponStatusLabel(coupon({ active: true, startsAt: '2026-06-11T09:00:00.000Z' }))).toBe(
      'SCHEDULED',
    );
    expect(formatDiscount({ type: 'percent', value: '15' })).toBe('15% off');
    expect(formatDiscount(null)).toBe('Unknown');
    expect(campaignToneClass('warn')).toBe('signal-warn');
    expect(campaignToneLabel('ok')).toBe('Clear');
  });

  it('builds command board from prepared buckets', () => {
    const live = [coupon({ active: true, id: 'live' })];
    const board = buildCampaignCommandBoard({
      expiredCoupons: [],
      liveCoupons: live,
      needsReview: [],
      pausedCoupons: [],
      scheduledCoupons: [],
    });

    expect(board[0]).toMatchObject({ coupons: live, status: 'Live', tone: 'info' });
    expect(board[3]).toMatchObject({ coupons: [], status: 'Needs decision', tone: 'ok' });
  });

  it('builds create notices for missing input, saved coupons, and failed codes', () => {
    expect(buildCouponCreateNotice({ notice: 'missing-required' })).toMatchObject({
      title: 'Coupon was not created',
      tone: 'danger',
    });
    expect(buildCouponCreateNotice({ created: '2', notice: 'created' })).toMatchObject({
      detail: '2 coupon(s) are now available in the coupon list.',
      tone: 'success',
    });
    expect(buildCouponCreateNotice({ created: '1', failed: '1', notice: 'partial' })).toMatchObject({
      title: 'Some coupons need attention',
      tone: 'warning',
    });
    expect(buildCouponCreateNotice({ failed: '2', notice: 'failed' })).toMatchObject({
      title: 'Coupon creation failed',
      tone: 'danger',
    });
    expect(buildCouponCreateNotice({ notice: 'admin-auth' })).toMatchObject({
      title: 'Admin session expired',
      tone: 'danger',
    });
    expect(buildCouponCreateNotice({ notice: 'invalid-date' })).toMatchObject({
      title: 'Coupon date value is invalid',
      tone: 'danger',
    });
    expect(buildCouponCreateNotice({ notice: 'updated' })).toMatchObject({
      title: 'Coupon updated',
      tone: 'success',
    });
    expect(buildCouponCreateNotice({ notice: 'deleted' })).toMatchObject({
      title: 'Coupon deleted',
      tone: 'success',
    });
    expect(buildCouponCreateNotice({ notice: 'delete-failed' })).toMatchObject({
      title: 'Coupon deletion failed',
      tone: 'danger',
    });
    expect(buildCouponCreateNotice({ notice: 'delete-used' })).toMatchObject({
      title: 'Used coupon cannot be deleted',
      tone: 'warning',
    });
    expect(buildCouponCreateNotice({ notice: 'unknown' })).toBeNull();
  });
});

function coupon(input: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    active: true,
    code: 'CODE',
    discount: { type: 'percent', value: 10 },
    id: 'coupon-1',
    ...input,
  };
}
