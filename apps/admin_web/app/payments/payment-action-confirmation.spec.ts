import type { AdminPayment } from '../../lib/admin-api';
import {
  buildPaymentActionConfirmation,
  paymentActionConfirmHref,
  readPaymentConfirmationAction,
} from './payment-action-confirmation';

const authorizedPayment = {
  id: 'payment-authorized-123456',
  amount: 150000,
  bookingId: 'booking-capture-123456',
  currency: 'VND',
  providerRef: 'GW-123',
  status: 'AUTHORIZED',
} as AdminPayment;

const capturedPayment = {
  ...authorizedPayment,
  id: 'payment-captured-123456',
  status: 'CAPTURED',
} as AdminPayment;

const paymentWithoutGatewayRef = {
  ...authorizedPayment,
  id: 'payment-no-ref-123456',
  providerRef: null,
} as AdminPayment;

describe('payment action confirmation', () => {
  it('builds a capture confirmation for an authorized payment', () => {
    const confirmation = buildPaymentActionConfirmation([authorizedPayment], 'capture', authorizedPayment.id);

    expect(confirmation).toEqual({
      action: 'capture',
      cancelHref: '/payments',
      confirmLabel: 'Capture payment',
      description: 'Capture 150000 VND for booking booking- after service evidence is reviewed.',
      disabled: false,
      paymentId: authorizedPayment.id,
      title: 'Capture payment payment-?',
      tone: 'warning',
    });
  });

  it('disables capture confirmation for a terminal payment', () => {
    const confirmation = buildPaymentActionConfirmation([capturedPayment], 'capture', capturedPayment.id);

    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.description).toBe('Payment is already CAPTURED; capture is not available.');
    expect(confirmation?.tone).toBe('neutral');
  });

  it('disables sync confirmation when the gateway reference is missing', () => {
    const confirmation = buildPaymentActionConfirmation([paymentWithoutGatewayRef], 'sync', paymentWithoutGatewayRef.id);

    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.description).toBe('Gateway reference is missing; sync is not available.');
  });

  it('allows detail pages to keep cancel navigation on the payment detail route', () => {
    const confirmation = buildPaymentActionConfirmation([authorizedPayment], 'release', authorizedPayment.id, {
      cancelHref: `/payments/${authorizedPayment.id}`,
    });

    expect(confirmation?.cancelHref).toBe(`/payments/${authorizedPayment.id}`);
  });

  it('returns null for unknown action or payment id', () => {
    expect(buildPaymentActionConfirmation([authorizedPayment], null, authorizedPayment.id)).toBeNull();
    expect(buildPaymentActionConfirmation([authorizedPayment], 'refund', 'missing')).toBeNull();
  });

  it('reads only supported confirmation actions', () => {
    expect(readPaymentConfirmationAction('capture')).toBe('capture');
    expect(readPaymentConfirmationAction('refund')).toBe('refund');
    expect(readPaymentConfirmationAction('release')).toBe('release');
    expect(readPaymentConfirmationAction('sync')).toBe('sync');
    expect(readPaymentConfirmationAction('delete')).toBeNull();
  });

  it('encodes the confirmation URL', () => {
    expect(paymentActionConfirmHref('payment 1', 'refund')).toBe('/payments?confirm=refund&paymentId=payment%201');
  });
});
