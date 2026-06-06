import { clientBookingPayment } from './bookings.response';

describe('client booking response helpers', () => {
  it('keeps only client-safe payment fields', () => {
    const payment = clientBookingPayment({
      id: 'payment-1',
      bookingId: 'booking-1',
      method: 'CASH',
      status: 'AUTHORIZED',
      amount: 450000,
      currency: 'VND',
      providerRef: 'internal-provider-ref',
      rawMeta: { gatewaySecret: 'hidden' },
    });

    expect(payment).toEqual({
      amount: 450000,
      method: 'CASH',
      status: 'AUTHORIZED',
      currency: 'VND',
    });
    expect(JSON.stringify(payment)).not.toContain('payment-1');
    expect(JSON.stringify(payment)).not.toContain('booking-1');
    expect(JSON.stringify(payment)).not.toContain('internal-provider-ref');
    expect(JSON.stringify(payment)).not.toContain('gatewaySecret');
  });
});
