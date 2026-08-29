import { BadRequestException, ConflictException } from '@nestjs/common';
import { Coupon, CouponRedemptionState } from '@prisma/client';

import {
  COUPON_RELEASE_REASON,
  COUPON_REVERSAL_REASON,
  consumeCouponRedemptionForBooking,
  normalizeBookingCouponCode,
  prepareCouponRedemptionReservation,
  recordCouponRedemptionReversal,
  releaseCouponRedemptionForBooking,
} from './bookings.coupon-redemption';

describe('booking coupon redemption reservation', () => {
  const checkedAt = new Date('2026-08-27T05:00:00.000Z');

  it('normalizes coupon codes for locking and idempotency fingerprints', () => {
    expect(normalizeBookingCouponCode(' welcome10 ')).toBe('WELCOME10');
  });

  it('applies the per-booking discount cap after locking a complete live coupon', async () => {
    const { result, tx } = reservation({
      coupon: coupon({ maximumDiscountAmount: 100_000 }),
      exposure: { budgetExposure: 0n, customerCount: 0n, totalCount: 0n },
    });

    await expect(result).resolves.toMatchObject({
      couponId: 'coupon-1',
      discountAmount: 100_000,
      priceSummary: { finalAmount: 400_000 },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['paused', { active: false }],
    ['not started', { startsAt: new Date(checkedAt.getTime() + 1) }],
    ['ending at the transaction clock', { endsAt: checkedAt }],
    ['open ended', { endsAt: null }],
    ['missing total limit', { maxRedemptions: null }],
    ['missing budget', { grossBudgetAmount: null }],
    ['missing customer limit', { perCustomerRedemptionLimit: null }],
    ['missing per-booking cap', { maximumDiscountAmount: null }],
    ['non-VND policy', { currency: null }],
    ['unsupported discount', { discount: { type: 'fixed', value: 10_000 } }],
  ])('fails closed for a %s coupon without exposing policy details', async (_label, patch) => {
    const { result, tx } = reservation({ coupon: coupon(patch) });

    await expectCouponError(result, 'COUPON_NOT_AVAILABLE', 'Coupon is not available');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns only a stable minimum-order error when the subtotal is too low', async () => {
    const { result } = reservation({
      coupon: coupon({ minimumOrderAmount: 600_000 }),
    });

    await expectCouponError(
      result,
      'COUPON_MINIMUM_NOT_MET',
      'Booking amount does not meet the coupon minimum',
    );
  });

  it.each([
    { budgetExposure: 0n, customerCount: 0n, totalCount: 10n },
    { budgetExposure: 0n, customerCount: 1n, totalCount: 1n },
    { budgetExposure: 950_001n, customerCount: 0n, totalCount: 0n },
  ])('sanitizes total, customer, and budget limit failures', async (exposure) => {
    const { result } = reservation({ exposure });

    const response = await couponErrorResponse(result);
    expect(response).toEqual({ code: 'COUPON_LIMIT_REACHED', message: 'Coupon is not available' });
    expect(JSON.stringify(response)).not.toMatch(/budget|customer|count|remaining/i);
  });

  it('releases a reserved redemption with an authoritative reason and timestamp', async () => {
    const occurredAt = new Date('2026-08-27T06:00:00.000Z');
    const tx = transitionClient(1);

    await expect(
      releaseCouponRedemptionForBooking(tx as never, {
        bookingId: 'booking-1',
        occurredAt,
        reason: COUPON_RELEASE_REASON.CUSTOMER_CANCELLED,
      }),
    ).resolves.toEqual({ state: CouponRedemptionState.RELEASED, transitioned: true });
    expect(tx.couponRedemption.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', state: CouponRedemptionState.RESERVED },
      data: {
        state: CouponRedemptionState.RELEASED,
        releasedAt: occurredAt,
        releaseReason: COUPON_RELEASE_REASON.CUSTOMER_CANCELLED,
      },
    });
  });

  it('consumes a reserved redemption exactly once and treats a retry as a no-op', async () => {
    const occurredAt = new Date('2026-08-27T07:00:00.000Z');
    const tx = transitionClient(0, CouponRedemptionState.CONSUMED);

    await expect(
      consumeCouponRedemptionForBooking(tx as never, { bookingId: 'booking-1', occurredAt }),
    ).resolves.toEqual({ state: CouponRedemptionState.CONSUMED, transitioned: false });
  });

  it('leaves legacy bookings without a redemption unchanged', async () => {
    const tx = transitionClient(0, null);

    await expect(
      releaseCouponRedemptionForBooking(tx as never, {
        bookingId: 'legacy-booking',
        occurredAt: checkedAt,
        reason: COUPON_RELEASE_REASON.MATCHING_EXPIRED,
      }),
    ).resolves.toEqual({ state: null, transitioned: false });
  });

  it('rejects a contradictory terminal transition', async () => {
    const tx = transitionClient(0, CouponRedemptionState.RELEASED);

    await expect(
      consumeCouponRedemptionForBooking(tx as never, {
        bookingId: 'booking-1',
        occurredAt: checkedAt,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records a partial authoritative reversal without changing the consumed state', async () => {
    const occurredAt = new Date('2026-08-27T08:00:00.000Z');
    const tx = reversalClient({ aggregateAmount: 0, discountAmount: 100_000 });

    await expect(
      recordCouponRedemptionReversal(tx as never, reversalInput({ amount: 40_000, occurredAt })),
    ).resolves.toEqual({
      eventCreated: true,
      reversedAmount: 40_000,
      state: CouponRedemptionState.CONSUMED,
    });
    expect(tx.couponRedemptionReversalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 40_000,
        couponRedemptionId: 'redemption-1',
        occurredAt,
        sourceKey: 'settlement-reversal-1',
      }),
    });
    expect(tx.couponRedemption.updateMany).not.toHaveBeenCalled();
  });

  it('moves to REVERSED only when accumulated evidence reaches the original discount', async () => {
    const occurredAt = new Date('2026-08-27T08:30:00.000Z');
    const tx = reversalClient({ aggregateAmount: 40_000, discountAmount: 100_000 });

    await expect(
      recordCouponRedemptionReversal(tx as never, reversalInput({ amount: 60_000, occurredAt })),
    ).resolves.toEqual({
      eventCreated: true,
      reversedAmount: 100_000,
      state: CouponRedemptionState.REVERSED,
    });
    expect(tx.couponRedemption.updateMany).toHaveBeenCalledWith({
      where: { id: 'redemption-1', state: CouponRedemptionState.CONSUMED },
      data: { reversedAt: occurredAt, state: CouponRedemptionState.REVERSED },
    });
  });

  it('treats an identical reversal source replay as a no-op', async () => {
    const occurredAt = new Date('2026-08-27T09:00:00.000Z');
    const tx = reversalClient({
      aggregateAmount: 40_000,
      discountAmount: 100_000,
      existing: {
        amount: 40_000,
        couponRedemptionId: 'redemption-1',
        occurredAt,
        reason: COUPON_REVERSAL_REASON.SETTLEMENT_REFUND,
        sourceReference: 'booking-settlement-snapshot:snapshot-1',
      },
    });

    await expect(
      recordCouponRedemptionReversal(tx as never, reversalInput({ amount: 40_000, occurredAt })),
    ).resolves.toEqual({
      eventCreated: false,
      reversedAmount: 40_000,
      state: CouponRedemptionState.CONSUMED,
    });
    expect(tx.couponRedemptionReversalEvent.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a reversal source with different financial evidence', async () => {
    const occurredAt = new Date('2026-08-27T09:00:00.000Z');
    const tx = reversalClient({
      aggregateAmount: 40_000,
      discountAmount: 100_000,
      existing: {
        amount: 40_000,
        couponRedemptionId: 'redemption-1',
        occurredAt,
        reason: COUPON_REVERSAL_REASON.SETTLEMENT_REFUND,
        sourceReference: 'booking-settlement-snapshot:snapshot-1',
      },
    });

    await expect(
      recordCouponRedemptionReversal(tx as never, reversalInput({ amount: 30_000, occurredAt })),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_REVERSAL_SOURCE_CONFLICT' }),
    });
    expect(tx.couponRedemptionReversalEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a reversal that would exceed the original discount', async () => {
    const tx = reversalClient({ aggregateAmount: 60_000, discountAmount: 100_000 });

    await expect(
      recordCouponRedemptionReversal(tx as never, reversalInput({ amount: 50_000 })),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_REVERSAL_EXCEEDS_DISCOUNT' }),
    });
    expect(tx.couponRedemptionReversalEvent.create).not.toHaveBeenCalled();
  });

  function reservation(input: {
    coupon?: Coupon;
    exposure?: { budgetExposure: bigint; customerCount: bigint; totalCount: bigint };
  }) {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ ...(input.coupon ?? coupon()), checkedAt }])
        .mockResolvedValueOnce([input.exposure ?? { budgetExposure: 0n, customerCount: 0n, totalCount: 0n }]),
    };
    return {
      result: prepareCouponRedemptionReservation(tx as never, {
        adminMinimumAmount: 300_000,
        couponCode: 'welcome50',
        customerPrice: 500_000,
        customerProfileId: 'customer-1',
      }),
      tx,
    };
  }

  function coupon(patch: Partial<Coupon> = {}): Coupon {
    return {
      active: true,
      code: 'WELCOME50',
      currency: 'VND',
      description: null,
      discount: { type: 'percent', value: 50 },
      endsAt: new Date(checkedAt.getTime() + 60_000),
      grossBudgetAmount: 1_000_000n,
      id: 'coupon-1',
      maxRedemptions: 10,
      maximumDiscountAmount: 200_000,
      minimumOrderAmount: 0,
      perCustomerRedemptionLimit: 1,
      startsAt: new Date(checkedAt.getTime() - 60_000),
      ...patch,
    };
  }

  function transitionClient(count: number, state?: CouponRedemptionState | null) {
    return {
      couponRedemption: {
        updateMany: vi.fn().mockResolvedValue({ count }),
        findUnique: vi.fn().mockResolvedValue(state === undefined ? null : state ? { state } : null),
      },
    };
  }

  function reversalInput(
    patch: Partial<Parameters<typeof recordCouponRedemptionReversal>[1]> = {},
  ): Parameters<typeof recordCouponRedemptionReversal>[1] {
    return {
      amount: 40_000,
      bookingId: 'booking-1',
      expectedCouponId: 'coupon-1',
      expectedCouponRedemptionId: 'redemption-1',
      occurredAt: new Date('2026-08-27T08:00:00.000Z'),
      reason: COUPON_REVERSAL_REASON.SETTLEMENT_REFUND,
      sourceKey: 'settlement-reversal-1',
      sourceReference: 'booking-settlement-snapshot:snapshot-1',
      ...patch,
    };
  }

  function reversalClient(input: {
    aggregateAmount: number;
    discountAmount: number;
    existing?: {
      amount: number;
      couponRedemptionId: string;
      occurredAt: Date;
      reason: string;
      sourceReference: string | null;
    } | null;
  }) {
    return {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ lockResult: '' }])
        .mockResolvedValueOnce([
          {
            consumedAt: new Date('2026-08-27T07:00:00.000Z'),
            couponId: 'coupon-1',
            discountAmount: input.discountAmount,
            id: 'redemption-1',
            state: CouponRedemptionState.CONSUMED,
          },
        ]),
      couponRedemption: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      couponRedemptionReversalEvent: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: input.aggregateAmount } }),
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
        findUnique: vi.fn().mockResolvedValue(input.existing ?? null),
      },
    };
  }
});

async function expectCouponError(promise: Promise<unknown>, code: string, message: string) {
  await expect(couponErrorResponse(promise)).resolves.toEqual({ code, message });
}

async function couponErrorResponse(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('Expected coupon reservation to fail');
}
