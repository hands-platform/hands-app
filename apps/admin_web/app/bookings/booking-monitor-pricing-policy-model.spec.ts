import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorPricingPolicyNeedsOps,
  buildBookingMonitorPricingPolicySignal,
} from './booking-monitor-pricing-policy-model';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    ...overrides,
  } as AdminBooking;
}

describe('booking monitor pricing policy model', () => {
  it('returns ready when booked service pricing has an active payout rule', () => {
    const item = booking({
      services: [
        {
          price: 900000,
          service: {
            basePrice: 700000,
            payoutRules: [
              {
                active: true,
                customerPrice: 900000,
                providerPayoutAmount: 650000,
              },
            ],
            priceStep: 100000,
          },
        },
      ] as AdminBooking['services'],
    });

    expect(buildBookingMonitorPricingPolicySignal(item)).toEqual({
      label: 'Pricing ready',
      status: 'ready',
      tone: 'pill-success',
    });
    expect(bookingMonitorPricingPolicyNeedsOps(item)).toBe(false);
  });

  it('flags missing service pricing as operations work', () => {
    const item = booking();

    expect(buildBookingMonitorPricingPolicySignal(item)).toMatchObject({
      label: 'Service missing',
      status: 'blocked',
    });
    expect(bookingMonitorPricingPolicyNeedsOps(item)).toBe(true);
  });
});
