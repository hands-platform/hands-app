import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  bookingServicePriceLabel,
} from './booking-service-labels';

describe('booking service label adapters', () => {
  it('builds list labels from booking service and payment data', () => {
    const booking = {
      payment: { amount: 300000, currency: 'VND' },
      services: [
        {
          price: 400000,
          service: {
            basePrice: 300000,
            durationMin: 90,
            name: 'Swedish Massage',
            payoutRules: [
              {
                active: true,
                currency: 'VND',
                customerPrice: 400000,
                providerPayoutAmount: 320000,
              },
            ],
          },
        },
      ],
    } as unknown as AdminBooking;

    expect(bookingServiceOptionLabel(booking)).toContain('Swedish Massage');
    expect(bookingServiceOptionLabel(booking)).toContain('90 min');
    expect(bookingServicePriceLabel(booking)).toContain('400.000 VND');
    expect(bookingServicePriceLabel(booking)).toContain('Minimum 300.000 VND');
    expect(bookingServicePayoutRuleLabel(booking)).toContain('Payout 320.000 VND');
  });

  it('falls back to payment amount when booked service price is missing', () => {
    const booking = {
      payment: { amount: 300000, currency: 'VND' },
      services: [{ service: { name: null, payoutRules: [] } }],
    } as unknown as AdminBooking;

    expect(bookingServicePriceLabel(booking)).toContain('300.000 VND');
    expect(bookingServicePayoutRuleLabel(booking)).toContain('Payout rule missing');
  });
});
