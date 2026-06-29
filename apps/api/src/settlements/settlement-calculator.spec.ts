import { calculateBookingSettlementAmounts } from './settlement-calculator';

describe('calculateBookingSettlementAmounts', () => {
  const baseInput = {
    customerPaymentAmount: 600_000,
    partnerPayoutAmount: 430_000,
    platformFeeGross: 128_000,
    partnerVatRateBps: 500,
    partnerPitRateBps: 200,
    platformVatRateBps: 800,
    paymentFeeRateBps: 0,
    paymentFeeFixedAmount: 0,
  } as const;

  it('splits partner withholding and platform output VAT using integer VND', () => {
    expect(
      calculateBookingSettlementAmounts({
        ...baseInput,
        paymentMethod: 'CARD',
      }),
    ).toMatchObject({
      partnerTaxableRevenue: 600_000,
      partnerVatAmount: 30_000,
      partnerPitAmount: 12_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentProcessingFee: 0,
      partnerWalletDelta: 388_000,
    });
  });

  it('creates a negative wallet delta for cash bookings', () => {
    expect(
      calculateBookingSettlementAmounts({
        ...baseInput,
        paymentMethod: 'CASH',
      }).partnerWalletDelta,
    ).toBe(-170_000);
  });

  it('keeps customer wallet settlement out of customer wallet credits while paying the partner net of withholding', () => {
    expect(
      calculateBookingSettlementAmounts({
        ...baseInput,
        paymentMethod: 'CUSTOMER_WALLET',
      }),
    ).toMatchObject({
      customerWalletCreditAmount: 0,
      customerWalletDebitAmount: 600_000,
      partnerWalletDelta: 388_000,
    });
  });

  it('stores payment processing fee separately from tax and platform VAT', () => {
    expect(
      calculateBookingSettlementAmounts({
        ...baseInput,
        paymentMethod: 'VNPAY',
        paymentFeeRateBps: 150,
        paymentFeeFixedAmount: 1_000,
      }),
    ).toMatchObject({
      partnerWithholdingTotal: 42_000,
      companyOutputVat: 9_481,
      paymentProcessingFee: 10_000,
    });
  });

  it('keeps coupon-paid amount separate from pre-coupon partner tax base', () => {
    expect(
      calculateBookingSettlementAmounts({
        ...baseInput,
        paymentMethod: 'CARD',
        customerPaymentAmount: 540_000,
        partnerTaxableRevenueAmount: 600_000,
      }),
    ).toMatchObject({
      customerWalletDebitAmount: 0,
      partnerTaxableRevenue: 600_000,
      partnerVatAmount: 30_000,
      partnerPitAmount: 12_000,
      partnerWithholdingTotal: 42_000,
      partnerWalletDelta: 388_000,
    });
  });
});
