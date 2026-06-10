import {
  bookingPricingPolicySignalFromFacts,
  type BookingPricingPolicySignalInput,
} from './booking-pricing-policy-signal';

const baseInput: BookingPricingPolicySignalInput = {
  customerPrice: 900000,
  hasBookedService: true,
  hasService: true,
  minimumPrice: 700000,
  payoutRules: [
    {
      active: true,
      customerPrice: 900000,
      providerPayoutAmount: 650000,
    },
  ],
  priceStep: 100000,
};

describe('bookingPricingPolicySignalFromFacts', () => {
  it.each([
    [
      { hasBookedService: false },
      { status: 'blocked', label: 'Service missing', tone: 'pill-danger' },
    ],
    [{ hasService: false }, { status: 'blocked', label: 'Service missing', tone: 'pill-danger' }],
    [{ customerPrice: null }, { status: 'blocked', label: 'Price missing', tone: 'pill-danger' }],
    [
      { customerPrice: 600000, minimumPrice: 700000 },
      { status: 'blocked', label: 'Below admin minimum', tone: 'pill-danger' },
    ],
    [
      { customerPrice: 950000, priceStep: 100000 },
      { status: 'blocked', label: 'Invalid price step', tone: 'pill-danger' },
    ],
    [
      { customerPrice: 900000, payoutRules: [] },
      { status: 'blocked', label: 'Active payout rule missing', tone: 'pill-danger' },
    ],
    [
      {
        customerPrice: 900000,
        payoutRules: [{ active: true, customerPrice: 900000, providerPayoutAmount: 950000 }],
      },
      { status: 'blocked', label: 'Partner payout exceeds price', tone: 'pill-danger' },
    ],
  ] satisfies ReadonlyArray<[Partial<BookingPricingPolicySignalInput>, ReturnType<typeof bookingPricingPolicySignalFromFacts>]>)(
    'returns blocked pricing signal',
    (overrides, expected) => {
      expect(bookingPricingPolicySignalFromFacts({ ...baseInput, ...overrides })).toEqual(expected);
    },
  );

  it('defaults the price step to 100000 when it is not configured', () => {
    expect(bookingPricingPolicySignalFromFacts({ ...baseInput, priceStep: null })).toEqual({
      status: 'ready',
      label: 'Pricing ready',
      tone: 'pill-success',
    });
  });

  it('returns warning when the company gross fee is zero', () => {
    expect(
      bookingPricingPolicySignalFromFacts({
        ...baseInput,
        payoutRules: [{ active: true, customerPrice: 900000, providerPayoutAmount: 900000 }],
      }),
    ).toEqual({
      status: 'warning',
      label: 'Zero company gross fee',
      tone: 'pill-warn',
    });
  });

  it('returns ready when service price and active payout rule are aligned', () => {
    expect(bookingPricingPolicySignalFromFacts(baseInput)).toEqual({
      status: 'ready',
      label: 'Pricing ready',
      tone: 'pill-success',
    });
  });
});
