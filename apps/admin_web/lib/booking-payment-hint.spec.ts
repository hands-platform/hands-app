import { bookingPaymentHint, type BookingPaymentHintInput } from './booking-payment-hint';

describe('booking payment hint', () => {
  it('shows no payment record when payment is missing', () => {
    const booking: BookingPaymentHintInput = {
      status: 'OPEN_MATCHING',
      payment: null,
    };

    expect(bookingPaymentHint(booking)).toBe('No payment record created.');
  });

  it('requires release or refund for expired bookings with an active payment state', () => {
    const booking: BookingPaymentHintInput = {
      status: 'EXPIRED',
      payment: { status: 'AUTHORIZED', method: 'VNPAY' },
    };

    expect(bookingPaymentHint(booking)).toBe(
      'Expired booking requires payment release/refund before closing.',
    );
  });

  it('requires payment decision for no-show bookings before closing', () => {
    const booking: BookingPaymentHintInput = {
      status: 'NO_SHOW',
      payment: { status: 'CAPTURED', method: 'MOMO' },
    };

    expect(bookingPaymentHint(booking)).toBe(
      'No-show requires payment decision before closing.',
    );
  });

  it('explains cash fee debt blocks final acceptance, service start, and payout release', () => {
    const booking: BookingPaymentHintInput = {
      status: 'COMPLETED',
      payment: { status: 'CAPTURED', method: 'CASH' },
    };

    expect(bookingPaymentHint(booking, { cashDebtNeedsSettlement: true })).toBe(
      'Cash fee debt is still unsettled; final acceptance, service start, and payout release are blocked.',
    );
  });

  it('keeps standard captured payment copy when there is no cash debt', () => {
    const booking: BookingPaymentHintInput = {
      status: 'COMPLETED',
      payment: { status: 'CAPTURED', method: 'VNPAY' },
    };

    expect(bookingPaymentHint(booking)).toBe('Payment captured.');
  });

  it('falls back to method monitoring copy for unknown payment states', () => {
    const booking: BookingPaymentHintInput = {
      status: 'MATCHED',
      payment: { status: 'PENDING_GATEWAY', method: 'VNPay' },
    };

    expect(bookingPaymentHint(booking)).toBe('VNPay payment is being monitored.');
  });
});
