import { BadRequestException } from '@nestjs/common';

import { calculateCouponDiscount, resolveCustomerPrice } from './bookings.pricing';

describe('booking pricing helpers', () => {
  it('calculates percentage coupon discounts without exceeding the subtotal', () => {
    expect(calculateCouponDiscount({ type: 'percent', value: 10 }, 300000)).toBe(30000);
    expect(calculateCouponDiscount({ type: 'percent', value: '150' }, 300000)).toBe(300000);
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
    expect(() => resolveCustomerPrice({ basePrice: 300000, priceStep: 50000 }, 0)).toThrow(
      BadRequestException,
    );
  });
});
