import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  isPreferredAwaitingDecision as isPreferredAwaitingDecisionFromStatus,
} from '../../../lib/booking-status-location-helpers';
import { preferredParticipantState } from './booking-status-location';

export function bookingPreferredAwaitingDecision(booking: AdminBookingDetail) {
  const participant = preferredParticipantState(booking);

  return isPreferredAwaitingDecisionFromStatus({
    finalSelection: booking.matchingEvidence?.finalSelection,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredParticipantStatus: participant?.status ?? null,
  });
}
