import type { AdminBooking } from '../../lib/admin-api';
import { activeBookingStatuses } from './booking-monitor-summary';
import { bookingChatRepairNeedsOps, bookingMatchingChatReady } from './booking-chat-handoff-state';
import { terminalBookingStatuses } from './booking-closure-list-signal';
import { bookingHasFinalPartner } from './booking-final-partner-state';
import { bookingHasProviderLocation } from './booking-location-ops-inputs';
import type { BookingMonitorEvidenceMatchReaders } from './booking-monitor-evidence-match';

export type BookingMonitorEvidenceOpsReaders = Pick<
  BookingMonitorEvidenceMatchReaders,
  | 'addressNeedsOps'
  | 'alertEvidenceNeedsOps'
  | 'cashDebtNeedsOps'
  | 'closeoutNeedsOps'
  | 'locationNeedsOps'
  | 'paymentNeedsOps'
>;

export function bookingMonitorEvidenceMatchReadersFromBooking(
  booking: AdminBooking,
  opsReaders: BookingMonitorEvidenceOpsReaders,
): BookingMonitorEvidenceMatchReaders {
  return {
    ...opsReaders,
    activeStatus: () => activeBookingStatuses.has(booking.status),
    chatLive: () => bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    hasFinalPartner: () => bookingHasFinalPartner(booking),
    hasProviderLocation: () => bookingHasProviderLocation(booking),
    status: () => booking.status,
    terminalStatus: () => terminalBookingStatuses.has(booking.status),
  };
}
