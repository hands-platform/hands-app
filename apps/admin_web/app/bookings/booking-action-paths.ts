export const BOOKING_PAYMENT_IMPACT_PATHS = [
  '/payments',
  '/refunds',
  '/earnings',
  '/partner-controls',
  '/partners',
] as const;

export const BOOKING_SETTLEMENT_IMPACT_PATHS = [
  '/payments',
  '/earnings',
  '/partner-controls',
  '/partners',
] as const;

export const BOOKING_CLOSEOUT_IMPACT_PATHS = [
  '/payments',
  '/earnings',
  '/payouts',
  '/partner-controls',
  '/partners',
] as const;

export const BOOKING_STATUS_FAILURE_IMPACT_PATHS = [
  '/payments',
  '/refunds',
  '/partner-controls',
  '/partners',
] as const;

export const BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS = [
  '/bookings/post-match-cancellations',
  '/earnings',
  '/cash-settlements',
  '/partner-controls',
  '/partners',
  '/operations-handoff',
] as const;

export function bookingActionRevalidatePaths(bookingId: string, extraPaths: readonly string[] = []) {
  return [`/bookings/${bookingId}`, '/bookings', ...extraPaths, '/audit-log'];
}
