import type { AdminBooking } from '../../lib/admin-api';
import type { BookingMonitorViewMatchReaders } from './booking-monitor-view-match';
import { bookingChatRepairNeedsOps, bookingMatchingChatReady } from './booking-chat-handoff-state';
import { activeBookingStatuses } from './booking-monitor-summary';

export type BookingMonitorViewOpsReaders = Pick<
  BookingMonitorViewMatchReaders,
  | 'addressNeedsOps'
  | 'cashDebtNeedsOps'
  | 'chatEvidenceNeedsOps'
  | 'closeoutNeedsOps'
  | 'decisionEvidenceMissing'
  | 'highPriorityCheck'
  | 'locationNeedsOps'
  | 'manualDecisionNeedsOps'
  | 'matchingEscalationNeedsOps'
  | 'paymentNeedsOps'
  | 'pricingPolicyNeedsOps'
  | 'refundReviewNeedsOps'
  | 'stageKey'
>;

export function bookingMonitorViewMatchReadersFromBooking(
  booking: AdminBooking,
  opsReaders: BookingMonitorViewOpsReaders,
): BookingMonitorViewMatchReaders {
  return {
    ...opsReaders,
    activeStatus: () => activeBookingStatuses.has(booking.status),
    chatLive: () => bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    noSupply: () => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
    postMatchCancellation: () =>
      booking.status === 'CANCELLED' &&
      Boolean(booking.matchedAt || booking.selectedProviderId || booking.selectedProvider),
    status: () => booking.status,
  };
}
