import {
  bookingMatchesMonitorBasicFilters,
  bookingMatchesMonitorPaymentFilter,
  bookingMatchesMonitorStatusFilter,
} from './booking-monitor-basic-filters';

describe('booking monitor basic filters', () => {
  it('matches all or exact booking status filters', () => {
    expect(bookingMatchesMonitorStatusFilter('MATCHED', 'all')).toBe(true);
    expect(bookingMatchesMonitorStatusFilter('MATCHED', 'MATCHED')).toBe(true);
    expect(bookingMatchesMonitorStatusFilter('MATCHED', 'NO_SHOW')).toBe(false);
  });

  it('matches all, exact, or missing payment method filters', () => {
    expect(bookingMatchesMonitorPaymentFilter('CASH', 'all')).toBe(true);
    expect(bookingMatchesMonitorPaymentFilter('CASH', 'CASH')).toBe(true);
    expect(bookingMatchesMonitorPaymentFilter(null, 'NO_PAYMENT')).toBe(true);
    expect(bookingMatchesMonitorPaymentFilter('CARD', 'CASH')).toBe(false);
  });

  it('requires both status and payment filters to match', () => {
    expect(
      bookingMatchesMonitorBasicFilters({
        paymentFilter: 'CASH',
        paymentMethod: 'CASH',
        status: 'MATCHED',
        statusFilter: 'MATCHED',
      }),
    ).toBe(true);

    expect(
      bookingMatchesMonitorBasicFilters({
        paymentFilter: 'CASH',
        paymentMethod: 'CARD',
        status: 'MATCHED',
        statusFilter: 'MATCHED',
      }),
    ).toBe(false);
  });
});
