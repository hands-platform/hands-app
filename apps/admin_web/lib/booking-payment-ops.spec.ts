import {
  bookingCompletedCloseoutNeedsOpsFromFacts,
  bookingManualDecisionNeedsOpsFromFacts,
  bookingPaymentNeedsOpsFromFacts,
  bookingPaymentReleaseNeedsOpsFromFacts,
  bookingRefundReviewNeedsOpsFromFacts,
} from './booking-payment-ops';

describe('booking payment operations helpers', () => {
  it('flags missing payment only while a booking is in an active pre-closeout state', () => {
    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        payment: null,
      }),
    ).toBe(true);

    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: null,
        completedCloseoutNeedsOps: true,
      }),
    ).toBe(false);
  });

  it('requires payment operations for unresolved cancelled, expired, and no-show payments', () => {
    for (const status of ['CANCELLED', 'EXPIRED', 'NO_SHOW']) {
      expect(
        bookingPaymentNeedsOpsFromFacts({
          status,
          payment: { status: 'AUTHORIZED' },
        }),
      ).toBe(true);

      expect(
        bookingPaymentNeedsOpsFromFacts({
          status,
          payment: { status: 'REFUNDED' },
        }),
      ).toBe(false);
    }
  });

  it('flags a payment release as pending until it is released or refunded', () => {
    expect(bookingPaymentReleaseNeedsOpsFromFacts({ payment: null })).toBe(false);
    expect(bookingPaymentReleaseNeedsOpsFromFacts({ payment: { status: 'AUTHORIZED' } })).toBe(
      true,
    );
    expect(bookingPaymentReleaseNeedsOpsFromFacts({ payment: { status: 'RELEASED' } })).toBe(
      false,
    );
    expect(bookingPaymentReleaseNeedsOpsFromFacts({ payment: { status: 'REFUNDED' } })).toBe(
      false,
    );
  });

  it('requires payment operations for payment holds, missing references, cash pending, and cash debt', () => {
    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: { status: 'AUTHORIZED', providerRef: 'momo-auth' },
      }),
    ).toBe(true);

    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'MATCHED',
        payment: { status: 'AUTHORIZED', providerRef: null },
      }),
    ).toBe(true);

    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'MATCHED',
        payment: { status: 'PENDING', method: 'CASH' },
      }),
    ).toBe(true);

    expect(
      bookingPaymentNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: { status: 'CAPTURED', method: 'CASH', providerRef: 'cash-note' },
        cashDebtNeedsOps: true,
      }),
    ).toBe(true);
  });

  it('delegates completed closeout checks to the shared closeout policy', () => {
    expect(
      bookingCompletedCloseoutNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: { status: 'CAPTURED' },
        earning: {
          taxLogs: [{ id: 'tax' }],
          platformFeeLogs: [{ id: 'fee' }],
          walletLedgerEntries: [{ id: 'wallet' }],
        },
      }),
    ).toBe(false);

    expect(
      bookingCompletedCloseoutNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: { status: 'CAPTURED' },
        earning: {
          taxLogs: [],
          platformFeeLogs: [{ id: 'fee' }],
          walletLedgerEntries: [{ id: 'wallet' }],
        },
      }),
    ).toBe(true);
  });

  it('flags refund review when refund rows and payment state disagree', () => {
    expect(
      bookingRefundReviewNeedsOpsFromFacts({
        status: 'COMPLETED',
        payment: { status: 'CAPTURED' },
        refundCount: 1,
      }),
    ).toBe(true);

    expect(
      bookingRefundReviewNeedsOpsFromFacts({
        status: 'CANCELLED',
        payment: { status: 'AUTHORIZED' },
      }),
    ).toBe(true);

    expect(
      bookingRefundReviewNeedsOpsFromFacts({
        status: 'CANCELLED',
        payment: { status: 'RELEASED' },
      }),
    ).toBe(false);
  });

  it('flags manual decision work only for closure, cash debt, or closeout conditions', () => {
    expect(bookingManualDecisionNeedsOpsFromFacts({ status: 'NO_SHOW' })).toBe(true);
    expect(bookingManualDecisionNeedsOpsFromFacts({ status: 'MATCHED', cashDebtNeedsOps: true })).toBe(
      true,
    );
    expect(
      bookingManualDecisionNeedsOpsFromFacts({
        status: 'COMPLETED',
        completedCloseoutNeedsOps: true,
      }),
    ).toBe(true);
    expect(bookingManualDecisionNeedsOpsFromFacts({ status: 'MATCHED' })).toBe(false);
  });
});
