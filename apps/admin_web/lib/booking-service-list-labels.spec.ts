import {
  bookingServiceListLabelsFromFacts,
  type BookingServiceListLabelsInput,
} from './booking-service-list-labels';

const formatMoney = (amount: number, currency: string) => `${currency} ${amount}`;

const baseInput: BookingServiceListLabelsInput = {
  currency: 'VND',
  customerPrice: null,
  durationMin: null,
  formatMoney,
  minimumPrice: null,
  payoutRules: [],
  serviceName: null,
};

describe('bookingServiceListLabelsFromFacts', () => {
  it('returns pending labels when service and price are missing', () => {
    expect(bookingServiceListLabelsFromFacts(baseInput)).toEqual({
      optionLabel: 'Service pending',
      payoutRuleLabel: null,
      priceLabel: 'Price pending',
    });
  });

  it('builds service option and price labels with a minimum price', () => {
    expect(
      bookingServiceListLabelsFromFacts({
        ...baseInput,
        customerPrice: 900000,
        durationMin: 90,
        minimumPrice: 700000,
        serviceName: 'Deep Tissue',
      }),
    ).toMatchObject({
      optionLabel: 'Deep Tissue / 90 min',
      priceLabel: 'Customer price VND 900000 / Minimum VND 700000',
    });
  });

  it('uses duration pending and no minimum copy when optional values are missing', () => {
    expect(
      bookingServiceListLabelsFromFacts({
        ...baseInput,
        customerPrice: 800000,
        serviceName: 'Aroma',
      }),
    ).toMatchObject({
      optionLabel: 'Aroma / duration pending',
      priceLabel: 'Customer price VND 800000',
    });
  });

  it('does not repeat an identical minimum price', () => {
    expect(
      bookingServiceListLabelsFromFacts({
        ...baseInput,
        customerPrice: 800000,
        minimumPrice: 800000,
        serviceName: 'Aroma',
      }).priceLabel,
    ).toBe('Customer price VND 800000');
  });

  it('returns missing payout rule copy when customer price has no active matching rule', () => {
    expect(
      bookingServiceListLabelsFromFacts({
        ...baseInput,
        customerPrice: 800000,
        serviceName: 'Aroma',
      }).payoutRuleLabel,
    ).toBe('Payout rule missing');
  });

  it('builds payout and fee labels from the active matching payout rule', () => {
    expect(
      bookingServiceListLabelsFromFacts({
        ...baseInput,
        currency: 'VND',
        customerPrice: 1000000,
        payoutRules: [
          {
            active: false,
            currency: 'VND',
            customerPrice: 1000000,
            providerPayoutAmount: 700000,
          },
          {
            active: true,
            currency: 'VND',
            customerPrice: 1000000,
            providerPayoutAmount: 760000,
          },
        ],
        serviceName: 'Aroma',
      }).payoutRuleLabel,
    ).toBe('Payout VND 760000 / fee VND 240000');
  });
});
