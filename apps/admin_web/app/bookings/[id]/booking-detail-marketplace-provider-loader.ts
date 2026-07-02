import { type AdminBookingDetail } from '../../../lib/admin-api';

export const BOOKING_DETAIL_TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'NO_SHOW',
]);

export function shouldLoadBookingDetailMarketplaceProviders(
  booking: Pick<AdminBookingDetail, 'status'> | null,
): boolean {
  if (!booking) return false;

  return !BOOKING_DETAIL_TERMINAL_STATUSES.has(booking.status);
}
