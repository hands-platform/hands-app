import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function calculateCouponDiscount(discount: Prisma.JsonValue, subtotal: number) {
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

  return Math.min(subtotal, Math.round((subtotal * value) / 100));
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
  if (customerPrice % priceStep !== 0) {
    throw new BadRequestException(`Partner service price must use ${priceStep} VND increments`);
  }
  return customerPrice;
}

export function resolveBookingPriceSummary(input: {
  customerPrice: number;
  adminMinimumAmount: number;
  coupon?: { id?: string | null; code?: string | null; discount: Prisma.JsonValue } | null;
}) {
  const discountAmount = input.coupon ? calculateCouponDiscount(input.coupon.discount, input.customerPrice) : 0;

  return {
    finalAmount: Math.max(0, input.customerPrice - discountAmount),
    paymentMetadata: {
      originalAmount: input.customerPrice,
      adminMinimumAmount: input.adminMinimumAmount,
      discountAmount,
      couponCode: input.coupon?.code,
      couponId: input.coupon?.id,
    },
    discountAmount,
  };
}
