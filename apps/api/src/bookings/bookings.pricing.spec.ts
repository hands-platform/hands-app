import { BadRequestException } from '@nestjs/common';

import {
  calculateCouponDiscount,
  resolveBookingPriceSummary,
  resolveCustomerPrice,
} from './bookings.pricing';

describe('booking pricing helpers', () => {
  it('calculates percentage coupon discounts without exceeding the subtotal', () => {
    expect(calculateCouponDiscount({ type: 'percent', value: 10 }, 300000)).toBe(30000);
    expect(calculateCouponDiscount({ type: 'percent', value: '150' }, 300000)).toBe(300000);
  });

  it('caps a percentage coupon at its per-booking maximum discount', () => {
    expect(calculateCouponDiscount({ type: 'percent', value: 50 }, 500000, 100000)).toBe(100000);
  });

  it('ignores unsupported or malformed coupon discounts', () => {
    expect(calculateCouponDiscount(null, 300000)).toBe(0);
    expect(calculateCouponDiscount({ type: 'fixed', value: 10000 }, 300000)).toBe(0);
    expect(calculateCouponDiscount({ type: 'percent', value: 0 }, 300000)).toBe(0);
    expect(calculateCouponDiscount({ type: 'percent', value: 'abc' }, 300000)).toBe(0);
  });

  it('uses provider price when it respects the admin minimum and price step', () => {
    expect(resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 350000)).toBe(350000);
    expect(resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, null)).toBe(300000);
  });

  it('rejects invalid provider prices', () => {
    expect(() => resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 250000)).toThrow(
      BadRequestException,
    );
    expect(() => resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 325000)).toThrow(
      BadRequestException,
    );
    expect(() => resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 600000)).toThrow(
      BadRequestException,
    );
    expect(() => resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 0)).toThrow(
      BadRequestException,
    );
  });

  it('builds booking payment totals and metadata from coupon pricing', () => {
    expect(
      resolveBookingPriceSummary({
        customerPrice: 500000,
        adminMinimumAmount: 300000,
        coupon: { id: 'coupon-1', code: 'WELCOME10', discount: { type: 'percent', value: 10 } },
      }),
    ).toEqual({
      finalAmount: 450000,
      discountAmount: 50000,
      paymentMetadata: {
        originalAmount: 500000,
        adminMinimumAmount: 300000,
        discountAmount: 50000,
        couponCode: 'WELCOME10',
        couponId: 'coupon-1',
        couponTypeSnapshot: 'percent',
        couponRateSnapshot: 10,
        couponFixedAmountSnapshot: null,
        couponFundingSourceSnapshot: 'COMPANY',
        couponAccountingTreatmentSnapshot: 'MARKETING_EXPENSE',
        settlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
        partnerTaxBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
        platformFeeBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
        referralBasePolicySnapshot: 'PLATFORM_FEE_NET_REVENUE',
      },
    });
  });

  it('builds booking payment totals without coupon metadata when no coupon is used', () => {
    expect(
      resolveBookingPriceSummary({
        customerPrice: 500000,
        adminMinimumAmount: 300000,
        coupon: null,
      }),
    ).toEqual({
      finalAmount: 500000,
      discountAmount: 0,
      paymentMetadata: {
        originalAmount: 500000,
        adminMinimumAmount: 300000,
        discountAmount: 0,
        couponCode: undefined,
        couponId: undefined,
      },
    });
  });
});
