import {
  BOOKING_CLOSEOUT_IMPACT_PATHS,
  BOOKING_PAYMENT_IMPACT_PATHS,
  BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS,
  BOOKING_SETTLEMENT_IMPACT_PATHS,
  BOOKING_STATUS_FAILURE_IMPACT_PATHS,
  bookingActionRevalidatePaths,
} from './booking-action-paths';

describe('booking action revalidation paths', () => {
  it('keeps the booking detail, list, extra paths, and audit log in order', () => {
    expect(bookingActionRevalidatePaths('booking-1', ['/payments', '/earnings'])).toEqual([
      '/bookings/booking-1',
      '/bookings',
      '/payments',
      '/earnings',
      '/audit-log',
    ]);
  });

  it('keeps payment, settlement, and closeout path groups explicit', () => {
    expect(BOOKING_PAYMENT_IMPACT_PATHS).toEqual([
      '/payments',
      '/refunds',
      '/earnings',
      '/partner-controls',
      '/partners',
    ]);
    expect(BOOKING_SETTLEMENT_IMPACT_PATHS).toEqual([
      '/payments',
      '/earnings',
      '/partner-controls',
      '/partners',
    ]);
    expect(BOOKING_CLOSEOUT_IMPACT_PATHS).toEqual([
      '/payments',
      '/earnings',
      '/payouts',
      '/partner-controls',
      '/partners',
    ]);
    expect(BOOKING_STATUS_FAILURE_IMPACT_PATHS).toEqual([
      '/payments',
      '/refunds',
      '/partner-controls',
      '/partners',
    ]);
    expect(BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS).toEqual([
      '/bookings/post-match-cancellations',
      '/earnings',
      '/cash-settlements',
      '/partner-controls',
      '/partners',
      '/operations-handoff',
    ]);
  });
});
