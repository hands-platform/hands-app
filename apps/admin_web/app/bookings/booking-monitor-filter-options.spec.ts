import {
  bookingPaymentFilterOptions,
  bookingStatusFilterOptions,
} from './booking-monitor-filter-options';

describe('booking monitor filter option helpers', () => {
  it('builds sorted unique booking status options', () => {
    expect(
      bookingStatusFilterOptions([
        { status: 'MATCHED' },
        { status: 'OPEN_MATCHING' },
        { status: 'MATCHED' },
      ]),
    ).toEqual(['MATCHED', 'OPEN_MATCHING']);
  });

  it('builds sorted unique payment method options with a no-payment fallback', () => {
    expect(
      bookingPaymentFilterOptions([
        { payment: { method: 'CASH' } },
        { payment: null },
        { payment: { method: 'MOMO' } },
        { payment: { method: 'CASH' } },
      ]),
    ).toEqual(['CASH', 'MOMO', 'NO_PAYMENT']);
  });
});
