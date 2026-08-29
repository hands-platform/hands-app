import type { AdminPayment } from '../../lib/admin-api';
import {
  buildPaymentActionConfirmation,
  paymentActionConfirmHref,
  paymentReturnTo,
  readPaymentConfirmationAction,
} from './payment-action-confirmation';

const availableCapture = decision({ action: 'CAPTURE', reason: 'Verified evidence supports capture.', recommended: true });
const blockedCapture = decision({ action: 'CAPTURE', reason: 'Booking is not completed.', state: 'BLOCKED' });
const payment = {
  actionDecisions: [availableCapture],
  amount: 150000,
  bookingId: 'booking-capture-123456',
  currency: 'VND',
  evidence: {
    label: 'Verified callback',
    reason: 'Accepted callback matches the payment amount.',
    state: 'VERIFIED',
    verifiedAt: '2026-08-09T02:00:00.000Z',
  },
  id: 'payment-authorized-123456',
} as AdminPayment;

describe('payment action confirmation', () => {
  it('builds confirmation from the server-owned action decision', () => {
    const confirmation = buildPaymentActionConfirmation([payment], 'capture', payment.id, {
      returnTo: '/payments?review=capture-ready&sort=oldest',
    });

    expect(confirmation).toMatchObject({
      action: 'capture',
      cancelHref: '/payments?review=capture-ready&sort=oldest',
      confirmLabel: 'Capture payment',
      disabled: false,
      paymentId: payment.id,
      policyVersion: 'admin-payment-actions-v1',
      reasonRequired: true,
      returnTo: '/payments?review=capture-ready&sort=oldest',
      tone: 'warning',
    });
    expect(confirmation?.description).toContain('Verified evidence supports capture.');
    expect(confirmation?.description).toContain('Evidence: Verified callback.');
    expect(confirmation?.description).toContain('150.000 VND');
    expect(confirmation?.idempotencyKey).toContain(`payments:capture:${payment.id}:`);
    expect(confirmation?.facts).toEqual(expect.arrayContaining([
      { format: 'datetime', label: 'Evidence verified', value: '2026-08-09T02:00:00.000Z' },
      { format: 'datetime', label: 'Policy evaluated', value: null },
    ]));
  });

  it('fails closed when the requested decision is blocked or absent', () => {
    const blocked = buildPaymentActionConfirmation(
      [{ ...payment, actionDecisions: [blockedCapture] }],
      'capture',
      payment.id,
    );
    const missing = buildPaymentActionConfirmation([payment], 'release', payment.id);

    expect(blocked).toMatchObject({ disabled: true, tone: 'neutral' });
    expect(blocked?.description).toContain('Booking is not completed.');
    expect(missing).toMatchObject({ disabled: true, policyVersion: 'unavailable', tone: 'neutral' });
    expect(missing?.description).toContain('server did not return an action decision');
  });

  it('preserves safe list and detail return locations', () => {
    expect(paymentReturnTo('/payments?review=evidence-conflict&confirm=capture&paymentId=1')).toBe(
      '/payments?review=evidence-conflict',
    );
    expect(paymentReturnTo('/payments/payment-1?returnTo=%2Fpayments%3Freview%3Dall')).toBe(
      '/payments/payment-1?returnTo=%2Fpayments%3Freview%3Dall',
    );
    expect(paymentReturnTo('/bookings/booking-1')).toBe('/payments');
    expect(paymentReturnTo('//evil.example/payments')).toBe('/payments');
  });

  it('reads supported actions and encodes the confirmation URL with context', () => {
    expect(readPaymentConfirmationAction('capture')).toBe('capture');
    expect(readPaymentConfirmationAction('refund')).toBe('refund');
    expect(readPaymentConfirmationAction('release')).toBe('release');
    expect(readPaymentConfirmationAction('sync')).toBe('sync');
    expect(readPaymentConfirmationAction('delete')).toBeNull();

    const href = paymentActionConfirmHref('payment 1', 'refund', '/payments?review=all');
    const url = new URL(href, 'http://admin.local');
    expect(url.pathname).toBe('/payments');
    expect(url.searchParams.get('confirm')).toBe('refund');
    expect(url.searchParams.get('paymentId')).toBe('payment 1');
    expect(url.searchParams.get('returnTo')).toBe('/payments?review=all');
  });

  it('copies safe list context into the confirmation background and rejects external context', () => {
    const returnTo = '/payments?review=release-recommended&q=booking-1&sort=oldest&page=3&paymentMethod=MOMO&paymentStatus=AUTHORIZED&bookingStatus=EXPIRED&evidence=verified&range=30d&age=4-24h&sla=critical';
    const href = paymentActionConfirmHref('payment-1', 'release', returnTo);
    const url = new URL(href, 'http://admin.local');

    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      age: '4-24h',
      bookingStatus: 'EXPIRED',
      confirm: 'release',
      evidence: 'verified',
      page: '3',
      paymentId: 'payment-1',
      paymentMethod: 'MOMO',
      paymentStatus: 'AUTHORIZED',
      q: 'booking-1',
      range: '30d',
      returnTo,
      review: 'release-recommended',
      sla: 'critical',
      sort: 'oldest',
    });

    expect(paymentActionConfirmHref('payment-1', 'release', 'https://evil.example/payments'))
      .toBe('/payments?confirm=release&paymentId=payment-1&returnTo=%2Fpayments');
  });
});

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
