import { buildBookingSettlementJournal } from './settlement-journal';

describe('buildBookingSettlementJournal', () => {
  it('builds balanced journal entries for a non-cash booking settlement without treating customer payment as revenue', () => {
    const journal = buildBookingSettlementJournal({
      bookingId: 'booking-1',
      currency: 'VND',
      customerPaymentAmount: 600_000,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentMethod: 'CARD',
      paymentProcessingFee: 10_000,
      metadata: {},
    });

    expect(journal.totalDebit).toBe(610_000);
    expect(journal.totalCredit).toBe(610_000);
    expect(journal.reconciliationDelta).toBe(0);
    expect(journal.entries).toEqual([
      expect.objectContaining({
        accountCode: 'booking_payment_clearing',
        amount: 600_000,
        side: 'DEBIT',
      }),
      expect.objectContaining({
        accountCode: 'payment_processing_fee_expense',
        amount: 10_000,
        side: 'DEBIT',
      }),
      expect.objectContaining({
          accountCode: 'partner_wallet_liability',
          amount: 430_000,
          side: 'CREDIT',
      }),
      expect.objectContaining({
        accountCode: 'partner_vat_pit_payable',
        amount: 42_000,
        side: 'CREDIT',
      }),
      expect.objectContaining({
        accountCode: 'platform_fee_net_revenue',
        amount: 118_519,
        side: 'CREDIT',
      }),
      expect.objectContaining({
        accountCode: 'company_output_vat_payable',
        amount: 9_481,
        side: 'CREDIT',
      }),
      expect.objectContaining({
        accountCode: 'payment_processing_fee_clearing',
        amount: 10_000,
        side: 'CREDIT',
      }),
    ]);
  });

  it('keeps company-funded coupon expense separate from platform fee revenue', () => {
    const journal = buildBookingSettlementJournal({
      bookingId: 'booking-coupon-1',
      currency: 'VND',
      customerPaymentAmount: 540_000,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentMethod: 'CARD',
      paymentProcessingFee: 0,
      metadata: {
        companyCouponExpense: 60_000,
      },
    });

    expect(journal.totalDebit).toBe(600_000);
    expect(journal.totalCredit).toBe(600_000);
    expect(journal.reconciliationDelta).toBe(0);
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'customer_coupon_marketing_expense',
          amount: 60_000,
          side: 'DEBIT',
        }),
      ]),
    );
    expect(journal.entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'coupon_discount_clearing',
        }),
      ]),
    );
  });

  it('records cash booking settlement against partner receivable instead of company bank cash', () => {
    const journal = buildBookingSettlementJournal({
      bookingId: 'booking-cash-1',
      currency: 'VND',
      customerPaymentAmount: 600_000,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentMethod: 'CASH',
      paymentProcessingFee: 0,
      metadata: {},
    });

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_receivable_negative_wallet',
          amount: 170_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'platform_fee_net_revenue',
          amount: 118_519,
          side: 'CREDIT',
        }),
        expect.objectContaining({
          accountCode: 'company_output_vat_payable',
          amount: 9_481,
          side: 'CREDIT',
        }),
        expect.objectContaining({
          accountCode: 'partner_vat_pit_payable',
          amount: 42_000,
          side: 'CREDIT',
        }),
      ]),
    );
  });

  it('reduces CASH partner receivable by company coupon expense without a reconciliation delta', () => {
    const journal = buildBookingSettlementJournal({
      bookingId: 'booking-cash-coupon-1',
      currency: 'VND',
      customerPaymentAmount: 540_000,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentMethod: 'CASH',
      paymentProcessingFee: 0,
      metadata: { companyCouponExpense: 60_000 },
    });

    expect(journal.reconciliationDelta).toBe(0);
    expect(journal.totalDebit).toBe(170_000);
    expect(journal.totalCredit).toBe(170_000);
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_receivable_negative_wallet',
          amount: 110_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'customer_coupon_marketing_expense',
          amount: 60_000,
          side: 'DEBIT',
        }),
      ]),
    );
    expect(journal.entries.some((entry) => entry.accountCode === 'settlement_reconciliation_delta')).toBe(false);
  });

  it('credits Partner wallet liability when a CASH coupon exceeds fees and withholding', () => {
    const journal = buildBookingSettlementJournal({
      bookingId: 'booking-cash-coupon-subsidy-1',
      currency: 'VND',
      customerPaymentAmount: 300_000,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      paymentMethod: 'CASH',
      paymentProcessingFee: 0,
      metadata: { companyCouponExpense: 300_000 },
    });

    expect(journal.reconciliationDelta).toBe(0);
    expect(journal.totalDebit).toBe(300_000);
    expect(journal.totalCredit).toBe(300_000);
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_wallet_liability',
          amount: 130_000,
          side: 'CREDIT',
        }),
      ]),
    );
  });
});
