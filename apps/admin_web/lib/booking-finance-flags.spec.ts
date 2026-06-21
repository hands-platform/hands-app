import {
  bookingCashDebtNeedsSettlement,
  bookingFinanceFlags,
} from './booking-finance-flags';

const formatMoney = (amount?: number | null, currency = 'VND') => `${amount ?? 0} ${currency}`;

describe('bookingFinanceFlags', () => {
  it('detects active cash fee debt only for unpaid negative cash earnings', () => {
    expect(
      bookingCashDebtNeedsSettlement({
        paymentMethod: 'CASH',
        hasEarning: true,
        earningNetAmount: -120000,
        earningStatus: 'PENDING',
      }),
    ).toBe(true);
    expect(
      bookingCashDebtNeedsSettlement({
        paymentMethod: 'CASH',
        hasEarning: true,
        earningNetAmount: -120000,
        earningStatus: 'PAID',
      }),
    ).toBe(false);
    expect(
      bookingCashDebtNeedsSettlement({
        paymentMethod: 'MOMO',
        hasEarning: true,
        earningNetAmount: -120000,
        earningStatus: 'PENDING',
      }),
    ).toBe(false);
    expect(
      bookingCashDebtNeedsSettlement({
        paymentMethod: 'CASH',
        hasEarning: false,
        earningNetAmount: -120000,
        earningStatus: 'PENDING',
      }),
    ).toBe(false);
  });

  it('flags a missing payout rule', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'OPEN_MATCHING',
      paymentAmount: null,
      servicePrice: null,
      hasEarning: false,
      earningNetAmount: null,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: false,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 380000,
        payoutRuleMissing: true,
        paymentMethod: 'MOMO',
        walletTotalAmount: 0,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Payout rule missing',
      }),
    ]);
  });

  it('flags a payment amount that differs from the booked service price', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'MATCHED',
      paymentAmount: 450000,
      servicePrice: 500000,
      hasEarning: false,
      earningNetAmount: null,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: false,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 380000,
        payoutRuleMissing: false,
        paymentMethod: 'MOMO',
        walletTotalAmount: 0,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'medium',
        title: 'Payment amount differs from booked service',
        detail: 'Payment is 450000 VND but booked service is 500000 VND.',
      }),
    ]);
  });

  it('flags a payout rule that would pay more than the customer charge', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'MATCHED',
      paymentAmount: 500000,
      servicePrice: 500000,
      hasEarning: false,
      earningNetAmount: null,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: false,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 600000,
        payoutRuleMissing: false,
        paymentMethod: 'MOMO',
        walletTotalAmount: 0,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Partner payout exceeds customer price',
      }),
    ]);
  });

  it('flags a completed booking without an earning record', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'COMPLETED',
      paymentAmount: 500000,
      servicePrice: 500000,
      hasEarning: false,
      earningNetAmount: null,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: false,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 380000,
        payoutRuleMissing: false,
        paymentMethod: 'MOMO',
        walletTotalAmount: 0,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Completed booking has no earning',
      }),
    ]);
  });

  it('flags cash debt settlement blocks with the Partner label and debt amount', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'COMPLETED',
      paymentAmount: 500000,
      servicePrice: 500000,
      hasEarning: true,
      earningNetAmount: -120000,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: true,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 380000,
        payoutRuleMissing: false,
        paymentMethod: 'CASH',
        walletTotalAmount: -120000,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Cash wallet debt blocks Partner',
        detail:
          'Linh Wellness owes 120000 VND before final acceptance, service start, or payout release can continue.',
      }),
    ]);
  });

  it('flags stale cash debt ledger evidence', () => {
    const flags = bookingFinanceFlags({
      bookingStatus: 'COMPLETED',
      paymentAmount: 500000,
      servicePrice: 500000,
      hasEarning: true,
      earningNetAmount: -120000,
      partnerLabel: 'Linh Wellness',
      cashDebtNeedsSettlement: false,
      financeTrace: {
        currency: 'VND',
        customerPriceAmount: 500000,
        providerPayoutAmount: 380000,
        payoutRuleMissing: false,
        paymentMethod: 'CASH',
        walletTotalAmount: 0,
      },
      formatMoney,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'medium',
        title: 'Cash debt ledger may be stale',
      }),
    ]);
  });
});
