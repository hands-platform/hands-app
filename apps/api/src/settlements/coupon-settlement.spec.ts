import { BadRequestException } from '@nestjs/common';

import { buildCouponSettlementContext } from './coupon-settlement';

describe('buildCouponSettlementContext', () => {
  it('settles company-funded coupons as company coupon expense', () => {
    const result = buildCouponSettlementContext({
      bookingServiceAmount: 500_000,
      customerPaymentAmount: 440_000,
      paymentRawMeta: {
        couponCode: 'WELCOME60',
        couponFundingSourceSnapshot: 'COMPANY',
        discountAmount: 60_000,
        originalAmount: 500_000,
      },
    });

    expect(result.companyCouponExpense).toBe(60_000);
    expect(result.customerPaymentAmount).toBe(440_000);
    expect(result.settlementBaseAmount).toBe(500_000);
    expect(result.metadata).toMatchObject({
      companyCouponExpense: 60_000,
      couponFundingSourceSnapshot: 'COMPANY',
      partnerFundedCouponAmount: 0,
      platformFeeDiscountAmount: 0,
    });
  });

  it.each(['PARTNER', 'PLATFORM_FEE'])(
    'rejects %s-funded coupons until funding-specific journals are implemented',
    fundingSource => {
      expect(() =>
        buildCouponSettlementContext({
          bookingServiceAmount: 500_000,
          customerPaymentAmount: 440_000,
          paymentRawMeta: {
            couponCode: 'UNSUPPORTED60',
            couponFundingSourceSnapshot: fundingSource,
            discountAmount: 60_000,
            originalAmount: 500_000,
          },
        }),
      ).toThrow(BadRequestException);
    },
  );
});
