import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type CouponSettlementContext = {
  companyCouponExpense: number;
  customerPaymentAmount: number;
  metadata?: Prisma.InputJsonObject;
  partnerTaxableRevenueAmount?: number;
  settlementBaseAmount: number;
};

type JsonRecord = Record<string, unknown>;

export function bookingServiceAmount(services: Array<{ price: number; quantity?: number | null }>) {
  return services.reduce((total, service) => total + service.price * (service.quantity ?? 1), 0);
}

export function buildCouponSettlementContext(input: {
  bookingServiceAmount: number;
  customerPaymentAmount: number;
  paymentRawMeta?: Prisma.JsonValue | null;
}): CouponSettlementContext {
  const rawMeta = jsonRecord(input.paymentRawMeta);
  const discountAmount = nonNegativeNumber(rawMeta?.discountAmount);
  const couponId = stringValue(rawMeta?.couponId);
  const couponCode = stringValue(rawMeta?.couponCode);
  const hasCoupon = discountAmount > 0 || Boolean(couponId || couponCode);
  const settlementBaseAmount =
    hasCoupon && nonNegativeNumber(rawMeta?.originalAmount) > 0
      ? nonNegativeNumber(rawMeta?.originalAmount)
      : input.bookingServiceAmount;

  if (!hasCoupon) {
    return {
      companyCouponExpense: 0,
      customerPaymentAmount: input.customerPaymentAmount,
      settlementBaseAmount,
    };
  }

  const fundingSource = couponFundingSource(rawMeta?.couponFundingSourceSnapshot);
  if (fundingSource !== 'COMPANY') {
    throw new BadRequestException(
      'Only company-funded coupons can be settled until coupon funding-specific journals are implemented.',
    );
  }
  const accountingTreatment = stringValue(rawMeta?.couponAccountingTreatmentSnapshot) ?? 'MARKETING_EXPENSE';
  const companyCouponExpense = discountAmount;
  const partnerFundedCouponAmount = 0;
  const platformFeeDiscountAmount = 0;
  const reviewFlag = discountAmount > 0 && !couponId && !couponCode ? 'MISSING_COUPON_REFERENCE' : undefined;

  return {
    companyCouponExpense,
    customerPaymentAmount: input.customerPaymentAmount,
    partnerTaxableRevenueAmount: settlementBaseAmount,
    settlementBaseAmount,
    metadata: compactJsonObject({
      bookingServiceAmount: settlementBaseAmount,
      customerPaidAmount: input.customerPaymentAmount,
      settlementBaseAmount,
      couponId,
      couponCodeSnapshot: couponCode,
      couponTypeSnapshot: stringValue(rawMeta?.couponTypeSnapshot),
      couponRateSnapshot: nullableNumber(rawMeta?.couponRateSnapshot),
      couponFixedAmountSnapshot: nullableNumber(rawMeta?.couponFixedAmountSnapshot),
      couponDiscountAmount: discountAmount,
      couponFundingSourceSnapshot: fundingSource,
      couponAccountingTreatmentSnapshot: accountingTreatment,
      settlementBasePolicySnapshot:
        stringValue(rawMeta?.settlementBasePolicySnapshot) ?? 'PRE_COUPON_SERVICE_AMOUNT',
      partnerTaxBasePolicySnapshot:
        stringValue(rawMeta?.partnerTaxBasePolicySnapshot) ?? 'PRE_COUPON_SERVICE_AMOUNT',
      platformFeeBasePolicySnapshot:
        stringValue(rawMeta?.platformFeeBasePolicySnapshot) ?? 'PRE_COUPON_SERVICE_AMOUNT',
      referralBasePolicySnapshot:
        stringValue(rawMeta?.referralBasePolicySnapshot) ?? 'PLATFORM_FEE_NET_REVENUE',
      companyCouponExpense,
      partnerFundedCouponAmount,
      platformFeeDiscountAmount,
      couponReversalStatus: 'NONE',
      couponReviewFlag: reviewFlag,
    }),
  };
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function nullableNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function nonNegativeNumber(value: unknown) {
  return Math.max(0, nullableNumber(value) ?? 0);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function couponFundingSource(value: unknown) {
  const fundingSource = stringValue(value)?.toUpperCase() ?? 'COMPANY';
  if (fundingSource === 'COMPANY' || fundingSource === 'PARTNER' || fundingSource === 'PLATFORM_FEE') {
    return fundingSource;
  }
  throw new BadRequestException(`Unsupported coupon funding source: ${fundingSource}`);
}

function compactJsonObject(input: Record<string, string | number | boolean | null | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
  ) as Prisma.InputJsonObject;
}
