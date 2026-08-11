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
    expect(confirmation?.idempotencyKey).toContain(`payments:capture:${payment.id}:`);
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
