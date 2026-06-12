import type { AdminBooking } from '../../lib/admin-api';
import { bookingPricingPolicySignalInput } from './booking-pricing-policy-inputs';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    ...overrides,
  } as AdminBooking;
}

describe('bookingPricingPolicySignalInput', () => {
  it('maps the booked service and active payout rules into pricing policy input', () => {
    const payoutRules = [
      {
        active: true,
        customerPrice: 900000,
        providerPayoutAmount: 650000,
      },
    ];
    const item = booking({
      payment: { amount: 800000 } as AdminBooking['payment'],
      services: [
        {
          price: 900000,
          service: {
            basePrice: 700000,
            payoutRules,
            priceStep: 100000,
          },
        },
      ] as AdminBooking['services'],
    });

    expect(bookingPricingPolicySignalInput(item)).toEqual({
      customerPrice: 900000,
      hasBookedService: true,
      hasService: true,
      minimumPrice: 700000,
      payoutRules,
      priceStep: 100000,
    });
  });

  it('falls back to payment amount when the booked service price is missing', () => {
    const item = booking({
      payment: { amount: 850000 } as AdminBooking['payment'],
      services: [
        {
          service: {
            basePrice: 700000,
            payoutRules: [],
            priceStep: 50000,
          },
        },
      ] as AdminBooking['services'],
    });

    expect(bookingPricingPolicySignalInput(item)).toMatchObject({
      customerPrice: 850000,
      hasBookedService: true,
      hasService: true,
    });
  });

  it('marks missing booked service and service inputs without payout rules', () => {
    expect(bookingPricingPolicySignalInput(booking())).toEqual({
      customerPrice: undefined,
      hasBookedService: false,
      hasService: false,
      minimumPrice: undefined,
      payoutRules: [],
      priceStep: undefined,
    });
  });
});
