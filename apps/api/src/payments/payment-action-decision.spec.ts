import {
  paymentActionDecision,
  paymentActionDecisions,
  paymentEvidenceSummary,
  paymentOperationDecision,
} from './payment-action-decision';

describe('payment action decisions', () => {
  it('allows online capture only for a completed booking with verified gateway evidence', () => {
    expect(paymentActionDecision(onlinePayment('COMPLETED'), 'CAPTURE')).toMatchObject({
      reasonCode: 'CAPTURE_READY',
      recommended: true,
      state: 'AVAILABLE',
    });
    expect(paymentActionDecision(onlinePayment('CANCELLED'), 'CAPTURE')).toMatchObject({
      reasonCode: 'BOOKING_NOT_COMPLETED',
      state: 'BLOCKED',
    });
  });

  it('recommends release for an uncaptured terminal booking', () => {
    expect(paymentActionDecision(onlinePayment('EXPIRED'), 'RELEASE')).toMatchObject({
      reasonCode: 'RELEASE_RECOMMENDED',
      recommended: true,
      state: 'AVAILABLE',
    });
  });

  it('uses evidence sync as the only primary action when non-terminal authorization evidence is missing', () => {
    const payment = { ...onlinePayment('EXPIRED'), callbackAttempts: [] };
    const operation = paymentOperationDecision(payment, '2026-08-10T00:00:00.000Z');

    expect(operation.primaryQueue).toBe('missing-gateway-evidence');
    expect(operation.primaryAction?.action).toBe('SYNC');
    expect(paymentActionDecision(payment, 'RELEASE')).toMatchObject({
      reasonCode: 'PAYMENT_EVIDENCE_NOT_VERIFIED',
      recommended: false,
      state: 'BLOCKED',
    });
    expect(paymentActionDecisions(payment).filter((decision) => decision.recommended)).toHaveLength(1);
  });

  it.each(['RELEASED', 'REFUNDED'])(
    'keeps missing-evidence %s payments in terminal history without executable sync',
    (status) => {
      const payment = {
        ...onlinePayment('EXPIRED'),
        callbackAttempts: [],
        status,
      };
      const operation = paymentOperationDecision(payment);

      expect(operation.primaryQueue).toBe(`history-${status.toLowerCase()}`);
      expect(operation.primaryAction).toBeNull();
      expect(paymentActionDecision(payment, 'SYNC')).toMatchObject({
        reasonCode: 'PAYMENT_STATE_NOT_SYNCABLE',
        recommended: false,
        state: 'BLOCKED',
      });
    },
  );

  it('keeps captured missing evidence visible for investigation without offering no-op sync', () => {
    const payment = {
      ...onlinePayment('COMPLETED'),
      callbackAttempts: [],
      status: 'CAPTURED',
    };
    const operation = paymentOperationDecision(payment);

    expect(operation.primaryQueue).toBe('missing-gateway-evidence');
    expect(operation.primaryAction).toBeNull();
    expect(paymentActionDecision(payment, 'SYNC')).toMatchObject({
      reasonCode: 'PAYMENT_STATE_NOT_SYNCABLE',
      state: 'BLOCKED',
    });
  });

  it.each(['AUTHORIZED', 'PENDING'])(
    'keeps sync available for non-terminal external payment state %s with a provider reference',
    (status) => {
      const payment = {
        ...onlinePayment('EXPIRED'),
        callbackAttempts: [],
        status,
      };

      expect(paymentActionDecision(payment, 'SYNC')).toMatchObject({
        reasonCode: 'SYNC_AVAILABLE',
        state: 'AVAILABLE',
      });
    },
  );

  it('keeps terminal callback conflicts in the evidence conflict queue', () => {
    const payment = {
      ...onlinePayment('EXPIRED'),
      callbackAttempts: [{
        callbackAmount: 300_000,
        outcome: 'REJECTED',
        signatureVerified: true,
      }],
      status: 'RELEASED',
    };

    expect(paymentOperationDecision(payment).primaryQueue).toBe('evidence-conflict');
  });

  it('splits terminal cash cleanup from completed authorization blockers', () => {
    expect(paymentOperationDecision({
      ...onlinePayment('CANCELLED'),
      callbackAttempts: [],
      method: 'CASH',
      providerRef: null,
      status: 'PENDING',
    }).primaryQueue).toBe('terminal-cash-cleanup');
    expect(paymentOperationDecision({
      ...onlinePayment('COMPLETED'),
      callbackAttempts: [],
      method: 'CUSTOMER_WALLET',
      providerRef: null,
    }).primaryQueue).toBe('completed-authorization-blocked');
  });

  it('requires retained cash collection evidence before manual cash capture', () => {
    const base = {
      ...onlinePayment('COMPLETED'),
      callbackAttempts: [],
      method: 'CASH',
      providerRef: null,
      status: 'PENDING',
    };
    expect(paymentActionDecision(base, 'CAPTURE')).toMatchObject({
      reasonCode: 'PAYMENT_EVIDENCE_NOT_VERIFIED',
      state: 'BLOCKED',
    });
    expect(
      paymentActionDecision(
        {
          ...base,
          rawMeta: {
            cashCollectedAt: '2026-08-09T08:00:00.000Z',
            cashCollectedBy: 'partner-1',
            cashCollectionReference: 'receipt-1',
          },
        },
        'CAPTURE',
      ),
    ).toMatchObject({ state: 'AVAILABLE' });
  });

  it('does not require a gateway reference for customer wallet evidence', () => {
    const payment = {
      ...onlinePayment('COMPLETED'),
      callbackAttempts: [],
      method: 'CUSTOMER_WALLET',
      providerRef: null,
      booking: {
        status: 'COMPLETED',
        customerWalletLedgerEntries: [
          {
            amount: -300_000,
            sourceKey: 'customer-wallet-payment:booking-1',
            createdAt: '2026-08-09T08:00:00.000Z',
          },
        ],
      },
    };
    expect(paymentEvidenceSummary(payment)).toMatchObject({ state: 'VERIFIED' });
    expect(paymentActionDecision(payment, 'CAPTURE')).toMatchObject({ state: 'AVAILABLE' });
  });

  it('allows refund submission only for captured payments', () => {
    expect(paymentActionDecision(onlinePayment('COMPLETED'), 'REQUEST_REFUND')).toMatchObject({
      reasonCode: 'PAYMENT_NOT_CAPTURED',
      state: 'BLOCKED',
    });
    expect(
      paymentActionDecision({ ...onlinePayment('COMPLETED'), status: 'CAPTURED' }, 'REQUEST_REFUND'),
    ).toMatchObject({
      reasonCode: 'REFUND_APPROVAL_REQUIRED',
      state: 'REVIEW_REQUIRED',
    });
  });
});

function onlinePayment(bookingStatus: string) {
  return {
    amount: 300_000,
    bookingId: 'booking-1',
    booking: { status: bookingStatus },
    callbackAttempts: [
      {
        callbackAmount: 300_000,
        createdAt: '2026-08-09T08:00:00.000Z',
        outcome: 'ACCEPTED',
        signatureVerified: true,
      },
    ],
    method: 'MOMO',
    providerRef: 'momo-1',
    status: 'AUTHORIZED',
  };
}
