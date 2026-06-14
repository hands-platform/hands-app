import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingParticipantProviderId,
  bookingPreferredProviderId,
} from './booking-participant-rules';

export type BookingParticipantCounts = {
  readonly total: number;
  readonly firstPick: number;
  readonly marketplace: number;
};

export function bookingParticipantCounts(booking: AdminBookingDetail): BookingParticipantCounts {
  const participants = booking.participants ?? [];
  const preferredProviderId = bookingPreferredProviderId(booking);
  const marketplace = participants.filter((participant) => {
    const providerId = bookingParticipantProviderId(participant);
    return !preferredProviderId || providerId !== preferredProviderId;
  }).length;

  return {
    total: participants.length,
    firstPick: Math.max(participants.length - marketplace, 0),
    marketplace,
  };
}
