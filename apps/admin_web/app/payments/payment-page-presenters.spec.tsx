import type { AdminPayment } from '../../lib/admin-api';
import { buildPaymentOperationsTableRows } from './payment-page-presenters';

describe('payment page presenters', () => {
  it('uses the recommended server decision as the primary safe action', () => {
    const [row] = buildPaymentOperationsTableRows([
      payment({
        actionDecisions: [
          decision({ action: 'CAPTURE', reason: 'Verified capture evidence.', recommended: true }),
          decision({ action: 'RELEASE', reason: 'Booking is completed.', state: 'BLOCKED' }),
        ],
        evidence: {
          label: 'Verified callback',
          reason: 'Signature and amount match.',
          state: 'VERIFIED',
          verifiedAt: '2026-08-09T02:00:00.000Z',
        },
      }),
    ], '/payments?review=capture-ready&sort=oldest');

    expect(row).toMatchObject({
      decisionLabel: 'Capture payment',
      decisionReason: 'Verified capture evidence.',
      evidenceLabel: 'Verified callback',
      paymentHref: expect.stringContaining('returnTo='),
    });
    expect(textContent(row?.primaryAction)).toContain('Capture payment');
    expect(textContent(row?.primaryAction)).not.toContain('Release authorization');
  });

  it('fails closed to detail review when no executable decision is returned', () => {
    const [row] = buildPaymentOperationsTableRows([payment({ actionDecisions: [] })]);

    expect(row).toMatchObject({
      decisionLabel: 'Review payment',
      decisionTone: 'neutral',
      evidenceLabel: 'Unavailable',
    });
    expect(textContent(row?.primaryAction)).toContain('Review evidence');
  });

  it('does not derive action availability from payment status in the presenter', () => {
    const [row] = buildPaymentOperationsTableRows([
      payment({
        actionDecisions: [decision({ action: 'SYNC', reason: 'Sync is blocked.', state: 'BLOCKED' })],
        status: 'AUTHORIZED',
      }),
    ]);

    expect(row).toMatchObject({
      decisionLabel: 'Review payment',
      decisionTone: 'neutral',
    });
    expect(textContent(row?.primaryAction)).toContain('Review evidence');
  });
});

function payment(input: Partial<AdminPayment> = {}): AdminPayment {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: 'VNPAY',
    providerRef: 'gateway-1',
    status: 'AUTHORIZED',
    ...input,
    booking: {
      createdAt: '2026-08-09T01:00:00.000Z',
      status: 'COMPLETED',
      ...input.booking,
    },
  };
}

function decision(input: Partial<NonNullable<AdminPayment['actionDecisions']>[number]> = {}) {
  return {
    action: 'SYNC' as const,
    policyVersion: 'admin-payment-actions-v1',
    reason: 'Gateway status can be synchronized.',
    reasonCode: 'SYNC_AVAILABLE',
    recommended: false,
    requiredEvidence: [],
    state: 'AVAILABLE' as const,
    verifiedAt: '2026-08-09T02:00:00.000Z',
    ...input,
  };
}

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  if (typeof value === 'object') {
    const props = (value as { props?: { children?: unknown } }).props;
    return textContent(props?.children);
  }
  return '';
}
