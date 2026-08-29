import { BadRequestException, ConflictException } from '@nestjs/common';
import { Coupon, CouponRedemptionState, Prisma } from '@prisma/client';

import { resolveBookingPriceSummary } from './bookings.pricing';

type LockedCoupon = Coupon & { checkedAt: Date };

type CouponExposure = {
  budgetExposure: bigint;
  customerCount: bigint;
  totalCount: bigint;
};

type LockedCouponRedemption = {
  consumedAt: Date | null;
  couponId: string;
  discountAmount: number;
  id: string;
  state: CouponRedemptionState;
};

export const COUPON_RELEASE_REASON = {
  CUSTOMER_CANCELLED: 'BOOKING_CUSTOMER_CANCELLED',
  MATCHING_EXPIRED: 'BOOKING_MATCHING_EXPIRED',
  NO_SHOW: 'BOOKING_NO_SHOW',
  PARTNER_CANCELLED: 'BOOKING_PARTNER_CANCELLED',
  PAYMENT_AUTHORIZATION_FAILED: 'BOOKING_PAYMENT_AUTHORIZATION_FAILED',
  PREFERRED_PARTNER_REJECTED: 'BOOKING_PREFERRED_PARTNER_REJECTED',
} as const;

export const COUPON_REVERSAL_REASON = {
  SETTLEMENT_REFUND: 'BOOKING_SETTLEMENT_REFUND_REVERSAL',
} as const;

type CouponRedemptionTransitionResult = {
  state: CouponRedemptionState | null;
  transitioned: boolean;
};

export function normalizeBookingCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export async function prepareCouponRedemptionReservation(
  tx: Prisma.TransactionClient,
  input: {
    adminMinimumAmount: number;
    couponCode: string;
    customerPrice: number;
    customerProfileId: string;
  },
) {
  await tx.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '5s'`);
  const [coupon] = await tx.$queryRaw<LockedCoupon[]>(Prisma.sql`
    SELECT coupon.*, clock_timestamp() AS "checkedAt"
    FROM "Coupon" coupon
    WHERE coupon."code" = ${normalizeBookingCouponCode(input.couponCode)}
    FOR UPDATE OF coupon
  `);

  if (!coupon || !coupon.active) {
    throw couponError('COUPON_NOT_AVAILABLE', 'Coupon is not available');
  }
  if (
    (coupon.startsAt && coupon.startsAt.getTime() > coupon.checkedAt.getTime()) ||
    !coupon.endsAt ||
    coupon.endsAt.getTime() <= coupon.checkedAt.getTime()
  ) {
    throw couponError('COUPON_NOT_AVAILABLE', 'Coupon is not available');
  }

  const minimumOrderAmount = coupon.minimumOrderAmount ?? 0;
  if (!completeCouponPolicy(coupon, minimumOrderAmount)) {
    throw couponError('COUPON_NOT_AVAILABLE', 'Coupon is not available');
  }
  if (input.customerPrice < minimumOrderAmount) {
    throw couponError('COUPON_MINIMUM_NOT_MET', 'Booking amount does not meet the coupon minimum');
  }

  const priceSummary = resolveBookingPriceSummary({
    adminMinimumAmount: input.adminMinimumAmount,
    coupon,
    customerPrice: input.customerPrice,
  });
  if (priceSummary.discountAmount <= 0) {
    throw couponError('COUPON_NOT_AVAILABLE', 'Coupon is not available');
  }

  const exposure = await couponExposure(tx, coupon.id, input.customerProfileId);
  if (
    exposure.totalCount + 1n > BigInt(coupon.maxRedemptions!) ||
    exposure.customerCount + 1n > BigInt(coupon.perCustomerRedemptionLimit!) ||
    exposure.budgetExposure + BigInt(priceSummary.discountAmount) > coupon.grossBudgetAmount!
  ) {
    throw couponError('COUPON_LIMIT_REACHED', 'Coupon is not available');
  }

  return {
    couponId: coupon.id,
    discountAmount: priceSummary.discountAmount,
    priceSummary,
  };
}

export function releaseCouponRedemptionForBooking(
  tx: Prisma.TransactionClient,
  input: { bookingId: string; occurredAt: Date; reason: string },
) {
  return transitionCouponRedemption(tx, {
    bookingId: input.bookingId,
    data: {
      state: CouponRedemptionState.RELEASED,
      releasedAt: input.occurredAt,
      releaseReason: input.reason,
    },
    targetState: CouponRedemptionState.RELEASED,
  });
}

export function consumeCouponRedemptionForBooking(
  tx: Prisma.TransactionClient,
  input: { bookingId: string; occurredAt: Date },
) {
  return transitionCouponRedemption(tx, {
    bookingId: input.bookingId,
    data: {
      state: CouponRedemptionState.CONSUMED,
      consumedAt: input.occurredAt,
    },
    targetState: CouponRedemptionState.CONSUMED,
  });
}

export async function recordCouponRedemptionReversal(
  tx: Prisma.TransactionClient,
  input: {
    amount: number;
    bookingId: string;
    expectedCouponId?: string | null;
    expectedCouponRedemptionId?: string | null;
    occurredAt: Date;
    reason: string;
    sourceKey: string;
    sourceReference?: string | null;
  },
) {
  const sourceKey = boundedText(input.sourceKey);
  const reason = boundedText(input.reason);
  if (!sourceKey || !reason || !positiveInteger(input.amount)) {
    throw couponError('COUPON_REVERSAL_INVALID', 'Coupon reversal evidence is invalid');
  }

  await tx.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`coupon-redemption-reversal:${sourceKey}`}, 0))::text AS "lockResult"`,
  );
  const [redemption] = await tx.$queryRaw<LockedCouponRedemption[]>(Prisma.sql`
    SELECT
      redemption."id",
      redemption."couponId",
      redemption."discountAmount",
      redemption."state",
      redemption."consumedAt"
    FROM "CouponRedemption" redemption
    WHERE redemption."bookingId" = ${input.bookingId}
    FOR UPDATE OF redemption
  `);
  if (!redemption) {
    return { eventCreated: false, reversedAmount: 0, state: null };
  }
  if (
    (input.expectedCouponRedemptionId && input.expectedCouponRedemptionId !== redemption.id) ||
    (input.expectedCouponId && input.expectedCouponId !== redemption.couponId)
  ) {
    throw couponReversalConflict(
      'COUPON_REVERSAL_EVIDENCE_MISMATCH',
      'Coupon reversal evidence does not match the booking redemption',
    );
  }

  const [existing, aggregate] = await Promise.all([
    tx.couponRedemptionReversalEvent.findUnique({
      where: { sourceKey },
      select: {
        amount: true,
        couponRedemptionId: true,
        occurredAt: true,
        reason: true,
        sourceReference: true,
      },
    }),
    tx.couponRedemptionReversalEvent.aggregate({
      where: { couponRedemptionId: redemption.id },
      _sum: { amount: true },
    }),
  ]);
  const reversedAmount = aggregate._sum.amount ?? 0;
  if (reversedAmount < 0 || reversedAmount > redemption.discountAmount) {
    throw couponReversalConflict(
      'COUPON_REVERSAL_TOTAL_INVALID',
      'Coupon reversal total is incompatible with the booking redemption',
    );
  }

  const sourceReference = boundedOptionalText(input.sourceReference);
  if (existing) {
    if (
      existing.couponRedemptionId === redemption.id &&
      existing.amount === input.amount &&
      existing.occurredAt.getTime() === input.occurredAt.getTime() &&
      existing.reason === reason &&
      existing.sourceReference === sourceReference
    ) {
      return { eventCreated: false, reversedAmount, state: redemption.state };
    }
    throw couponReversalConflict(
      'COUPON_REVERSAL_SOURCE_CONFLICT',
      'Coupon reversal source already exists with different evidence',
    );
  }
  if (redemption.state !== CouponRedemptionState.CONSUMED || !redemption.consumedAt) {
    throw couponReversalConflict(
      'COUPON_REDEMPTION_STATE_CONFLICT',
      'Coupon redemption is incompatible with settlement reversal',
    );
  }
  if (input.occurredAt.getTime() < redemption.consumedAt.getTime()) {
    throw couponReversalConflict(
      'COUPON_REVERSAL_TIME_CONFLICT',
      'Coupon reversal predates the consumed redemption',
    );
  }

  const nextReversedAmount = reversedAmount + input.amount;
  if (nextReversedAmount > redemption.discountAmount) {
    throw couponReversalConflict(
      'COUPON_REVERSAL_EXCEEDS_DISCOUNT',
      'Coupon reversal exceeds the original booking discount',
    );
  }
  await tx.couponRedemptionReversalEvent.create({
    data: {
      amount: input.amount,
      couponRedemptionId: redemption.id,
      occurredAt: input.occurredAt,
      reason,
      sourceKey,
      sourceReference,
    },
  });

  if (nextReversedAmount < redemption.discountAmount) {
    return {
      eventCreated: true,
      reversedAmount: nextReversedAmount,
      state: CouponRedemptionState.CONSUMED,
    };
  }

  const transition = await tx.couponRedemption.updateMany({
    where: { id: redemption.id, state: CouponRedemptionState.CONSUMED },
    data: { reversedAt: input.occurredAt, state: CouponRedemptionState.REVERSED },
  });
  if (transition.count !== 1) {
    throw couponReversalConflict(
      'COUPON_REDEMPTION_STATE_CONFLICT',
      'Coupon redemption changed while recording settlement reversal',
    );
  }
  return {
    eventCreated: true,
    reversedAmount: nextReversedAmount,
    state: CouponRedemptionState.REVERSED,
  };
}

async function transitionCouponRedemption(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    data: Prisma.CouponRedemptionUpdateManyMutationInput;
    targetState: CouponRedemptionState;
  },
): Promise<CouponRedemptionTransitionResult> {
  const transition = await tx.couponRedemption.updateMany({
    where: { bookingId: input.bookingId, state: CouponRedemptionState.RESERVED },
    data: input.data,
  });
  if (transition.count === 1) {
    return { state: input.targetState, transitioned: true };
  }

  const current = await tx.couponRedemption.findUnique({
    where: { bookingId: input.bookingId },
    select: { state: true },
  });
  if (!current) {
    return { state: null, transitioned: false };
  }
  if (current.state === input.targetState) {
    return { state: current.state, transitioned: false };
  }
  throw new ConflictException({
    code: 'COUPON_REDEMPTION_STATE_CONFLICT',
    message: 'Coupon redemption is incompatible with the latest booking state',
  });
}

function completeCouponPolicy(coupon: Coupon, minimumOrderAmount: number) {
  const discount = coupon.discount;
  const discountRecord =
    discount && typeof discount === 'object' && !Array.isArray(discount)
      ? (discount as Record<string, unknown>)
      : null;
  const rate =
    typeof discountRecord?.value === 'number'
      ? discountRecord.value
      : typeof discountRecord?.value === 'string'
        ? Number(discountRecord.value)
        : Number.NaN;

  return (
    coupon.currency === 'VND' &&
    positiveInteger(coupon.maxRedemptions) &&
    typeof coupon.grossBudgetAmount === 'bigint' &&
    coupon.grossBudgetAmount > 0n &&
    positiveInteger(coupon.perCustomerRedemptionLimit) &&
    coupon.perCustomerRedemptionLimit! <= coupon.maxRedemptions! &&
    nonNegativeInteger(minimumOrderAmount) &&
    positiveInteger(coupon.maximumDiscountAmount) &&
    discountRecord?.type === 'percent' &&
    Number.isFinite(rate) &&
    rate >= 1 &&
    rate <= 100
  );
}

async function couponExposure(tx: Prisma.TransactionClient, couponId: string, customerProfileId: string) {
  const [row] = await tx.$queryRaw<CouponExposure[]>(Prisma.sql`
    WITH active_redemption AS (
      SELECT "id", "customerProfileId", "discountAmount", "state"
      FROM "CouponRedemption"
      WHERE "couponId" = ${couponId}
        AND "state" <> 'RELEASED'
    ), reversal AS (
      SELECT
        event."couponRedemptionId",
        COALESCE(SUM(event."amount"), 0)::bigint AS "reversedAmount"
      FROM "CouponRedemptionReversalEvent" event
      INNER JOIN active_redemption redemption
        ON redemption."id" = event."couponRedemptionId"
      GROUP BY event."couponRedemptionId"
    )
    SELECT
      COUNT(*)::bigint AS "totalCount",
      COUNT(*) FILTER (
        WHERE redemption."customerProfileId" = ${customerProfileId}
      )::bigint AS "customerCount",
      COALESCE(SUM(
        CASE
          WHEN redemption."state" = 'RESERVED' THEN redemption."discountAmount"::bigint
          ELSE GREATEST(
            redemption."discountAmount"::bigint - COALESCE(reversal."reversedAmount", 0),
            0
          )
        END
      ), 0)::bigint AS "budgetExposure"
    FROM active_redemption redemption
    LEFT JOIN reversal ON reversal."couponRedemptionId" = redemption."id"
  `);
  return row ?? { budgetExposure: 0n, customerCount: 0n, totalCount: 0n };
}

function couponError(code: string, message: string) {
  return new BadRequestException({ code, message });
}

function couponReversalConflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

function boundedText(value: string) {
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 500 ? normalized : null;
}

function boundedOptionalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  return boundedText(value);
}

function positiveInteger(value: number | null) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0;
}

function nonNegativeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}
