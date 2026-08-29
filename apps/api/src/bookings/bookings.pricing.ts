import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function calculateCouponDiscount(
  discount: Prisma.JsonValue,
  subtotal: number,
  maximumDiscountAmount?: number | null,
) {
  if (!discount || typeof discount !== 'object' || Array.isArray(discount)) {
    return 0;
  }

  const input = discount as { type?: unknown; value?: unknown };
  const type = typeof input.type === 'string' ? input.type : null;
  const value =
    typeof input.value === 'number'
      ? input.value
      : typeof input.value === 'string'
        ? Number(input.value)
        : NaN;

  if (type !== 'percent' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const maximum =
    Number.isSafeInteger(maximumDiscountAmount) && (maximumDiscountAmount ?? 0) > 0
      ? maximumDiscountAmount!
      : subtotal;
  return Math.min(subtotal, maximum, Math.round((subtotal * value) / 100));
}

function couponDiscountRecord(discount: Prisma.JsonValue) {
  if (!discount || typeof discount !== 'object' || Array.isArray(discount)) {
    return null;
  }
  return discount as Record<string, unknown>;
}

function couponSnapshotNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function couponSnapshotString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function couponPricingPolicyMetadata(coupon: { discount: Prisma.JsonValue } | null | undefined) {
  if (!coupon) {
    return {};
  }

  const discount = couponDiscountRecord(coupon.discount);
  const type = couponSnapshotString(discount?.type);
  const value = couponSnapshotNumber(discount?.value);

  return {
    couponTypeSnapshot: type,
    couponRateSnapshot: type === 'percent' ? value : null,
    couponFixedAmountSnapshot: type === 'fixed' ? value : null,
    couponFundingSourceSnapshot: couponSnapshotString(discount?.fundingSource) ?? 'COMPANY',
    couponAccountingTreatmentSnapshot:
      couponSnapshotString(discount?.accountingTreatment) ?? 'MARKETING_EXPENSE',
    settlementBasePolicySnapshot:
      couponSnapshotString(discount?.settlementBasePolicy) ?? 'PRE_COUPON_SERVICE_AMOUNT',
    partnerTaxBasePolicySnapshot:
      couponSnapshotString(discount?.partnerTaxBasePolicy) ?? 'PRE_COUPON_SERVICE_AMOUNT',
    platformFeeBasePolicySnapshot:
      couponSnapshotString(discount?.platformFeeBasePolicy) ?? 'PRE_COUPON_SERVICE_AMOUNT',
    referralBasePolicySnapshot: couponSnapshotString(discount?.referralBasePolicy) ?? 'PLATFORM_FEE_NET_REVENUE',
  };
}

export function resolveCustomerPrice(
  service: { basePrice: number; priceStep?: number | null },
  providerPrice?: number | null,
) {
  const customerPrice = providerPrice ?? service.basePrice;
  const priceStep = service.priceStep ?? 100000;
  if (!Number.isInteger(customerPrice) || customerPrice <= 0) {
    throw new BadRequestException('Partner service price is invalid');
  }
  if (customerPrice < service.basePrice) {
    throw new BadRequestException('Partner service price cannot be lower than the admin minimum');
  }
  if (customerPrice >= service.basePrice * 2) {
    throw new BadRequestException('Partner service price cannot be 2x or more than the admin minimum');
  }
  if (customerPrice % priceStep !== 0) {
    throw new BadRequestException(`Partner service price must use ${priceStep} VND increments`);
  }
  return customerPrice;
}

export function resolveBookingPriceSummary(input: {
  customerPrice: number;
  adminMinimumAmount: number;
  coupon?: {
    id?: string | null;
    code?: string | null;
    discount: Prisma.JsonValue;
    maximumDiscountAmount?: number | null;
  } | null;
}) {
  const discountAmount = input.coupon
    ? calculateCouponDiscount(
        input.coupon.discount,
        input.customerPrice,
        input.coupon.maximumDiscountAmount,
      )
    : 0;

  return {
    finalAmount: Math.max(0, input.customerPrice - discountAmount),
    paymentMetadata: {
      originalAmount: input.customerPrice,
      adminMinimumAmount: input.adminMinimumAmount,
      discountAmount,
      couponCode: input.coupon?.code,
      couponId: input.coupon?.id,
      ...couponPricingPolicyMetadata(input.coupon),
    },
    discountAmount,
  };
}
