import type { AdminPayment, AdminPaymentCallbackAttempt } from '../../lib/admin-api';
import { paymentActionExecutionMap } from './payment-action-execution-map';
import { emptyPaymentMessage, paymentFilterDescription, paymentRangeLinks, withPaymentRange } from './payment-page-links';
import { buildPaymentCallbackAttemptsApiHref, buildPaymentOperationsApiHref, buildPaymentPageModel } from './payment-page-model';
import { paymentCallbackMeta, paymentCashDebtNeedsSettlement } from './payment-page-rules';

describe('payment page model', () => {
  it('sorts and summarizes visible payment operations without changing payment status', () => {
    const model = buildPaymentPageModel({
      callbackAttempts: [callbackAttempt({ id: 'callback-review', outcome: 'CONFLICT', signatureVerified: false })],
      params: { range: 'all' },
      payments: [
        payment({ id: 'captured', status: 'CAPTURED' }),
        payment({ booking: { earning: cashDebtEarning(), status: 'COMPLETED' }, id: 'cash-debt', method: 'CASH', status: 'PENDING' }),
        payment({ id: 'authorized', providerRef: 'gw-1', status: 'AUTHORIZED' }),
      ],
    });

    expect(model.payments.map((item) => item.id)).toEqual(['cash-debt', 'authorized', 'captured']);
    expect(model.metrics).toMatchObject({
      authorized: 1,
      callbackReview: 1,
      captured: 1,
      cashDebt: 1,
      needsAction: 2,
      pendingCash: 1,
    });
    expect(model.callbackAttemptRows[0]).toMatchObject({
      id: 'callback-review',
      pillClass: 'pill-danger',
      signatureLabel: 'Not verified',
    });
  });

  it('filters cash debt and callback review queues independently', () => {
    const cashDebt = payment({
      booking: { earning: cashDebtEarning(), status: 'COMPLETED' },
      id: 'cash-debt',
      method: 'CASH',
      status: 'PENDING',
    });
    const callbackReview = payment({
      id: 'callback-review-payment',
      rawMeta: { callbackReceivedAt: '2026-06-10T08:00:00.000Z', callbackSignatureVerified: false },
    });

    expect(
      buildPaymentPageModel({
        callbackAttempts: [],
        params: { range: 'all', review: 'cash-debt' },
        payments: [cashDebt, callbackReview],
      })
        .payments.map((item) => item.id),
    ).toEqual(['cash-debt']);
    expect(
      buildPaymentPageModel({
        callbackAttempts: [],
        params: { range: 'all', review: 'callback-review' },
        payments: [cashDebt, callbackReview],
      }).payments.map((item) => item.id),
    ).toEqual(['callback-review-payment']);
  });

  it('defaults the operations board to today when no range is selected', () => {
    const model = buildPaymentPageModel({
      callbackAttempts: [],
      params: {},
      payments: [],
    });

    expect(model.filters.range).toBe('today');
    expect(model.dateRangeLabel).toBe('Today (Vietnam)');
  });

  it('builds bounded API hrefs from the selected payment filters', () => {
    const model = buildPaymentPageModel({
      callbackAttempts: [],
      params: { range: '7d', review: 'callback-review' },
      payments: [],
    });

    expect(buildPaymentOperationsApiHref(model.filters)).toBe(
      '/admin/payments?take=10&range=7d&review=callback-review',
    );
    expect(buildPaymentCallbackAttemptsApiHref(model.filters)).toBe(
      '/admin/payment-callback-attempts?take=10&range=7d&review=callback-review',
    );
  });

  it('keeps callback metadata, filter links, and empty copy stable', () => {
    expect(
      paymentCallbackMeta(
        payment({
          rawMeta: {
            callbackReceivedAt: '2026-06-10T08:00:00.000Z',
            callbackSignatureVerified: 'true',
            vnp_Amount: '123400',
            vnp_ResponseCode: '00',
            vnp_TransactionNo: 'vnp-1',
          },
        }),
      ),
    ).toMatchObject({
      callbackAmount: 1234,
      gatewayTransactionId: 'vnp-1',
      providerStatus: '00',
      verified: true,
    });
    expect(paymentRangeLinks('cash-debt')[1]).toEqual({
      href: '/payments?range=today&review=cash-debt',
      label: 'Today',
      range: 'today',
    });
    expect(withPaymentRange('/payments?review=cash', '7d')).toBe('/payments?review=cash&range=7d');
    expect(paymentFilterDescription('refund')).toBe('all payment records.');
    expect(emptyPaymentMessage('cash')).toContain('cash bookings waiting for collection confirmation');
  });

  it('builds action execution evidence for capture and cash debt cases', () => {
    const authorizedCompleted = payment({ booking: { status: 'COMPLETED' }, providerRef: 'gw-1', status: 'AUTHORIZED' });
    const cashDebt = payment({
      booking: { earning: cashDebtEarning(), status: 'COMPLETED' },
      method: 'CASH',
      status: 'PENDING',
    });

    expect(paymentActionExecutionMap(authorizedCompleted).find((row) => row.action === 'Capture')).toMatchObject({
      pillClass: 'pill-warn',
      status: 'Review capture',
    });
    expect(paymentCashDebtNeedsSettlement(cashDebt)).toBe(true);
    expect(paymentActionExecutionMap(cashDebt).find((row) => row.action === 'Settle cash debt')).toMatchObject({
      pillClass: 'pill-danger',
      status: 'Evidence required',
    });
  });
});

function payment(input: Partial<AdminPayment> = {}): AdminPayment {
  const booking = {
    createdAt: '2026-06-10T08:00:00.000Z',
    ...input.booking,
  };

  return {
    amount: 100000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: 'CARD',
    status: 'AUTHORIZED',
    ...input,
    booking,
  };
}

function callbackAttempt(input: Partial<AdminPaymentCallbackAttempt> = {}): AdminPaymentCallbackAttempt {
  return {
    createdAt: '2026-06-10T08:00:00.000Z',
    id: 'callback-1',
    method: 'VNPAY',
    outcome: 'ACCEPTED',
    ...input,
  };
}

function cashDebtEarning(): NonNullable<NonNullable<AdminPayment['booking']>['earning']> {
  return {
    currency: 'VND',
    grossAmount: 100000,
    id: 'earning-1',
    netAmount: -20000,
    platformFee: 20000,
    status: 'PENDING',
    withholdingAmount: 0,
  };
}
