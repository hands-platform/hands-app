import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import {
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
} from '../../lib/booking-participant-choice';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

export type BookingMonitorListMarketplaceParticipantPill = {
  readonly id: string;
  readonly partnerLabel: string;
  readonly status: string;
};

export function bookingMonitorListMarketplaceParticipantOverflowCount(
  participants: readonly BookingParticipant[],
  visibleLimit = 4,
): number {
  return Math.max(0, participants.length - visibleLimit);
}

export function bookingMonitorListMarketplaceParticipants(
  participants: readonly BookingParticipant[],
  visibleLimit = 4,
): BookingMonitorListMarketplaceParticipantPill[] {
  return participants.slice(0, visibleLimit).map((participant) => ({
    id: participant.id,
    partnerLabel: providerDisplayName(participant.providerProfile),
    status: participant.status,
  }));
}

export function bookingMonitorListSelectedFinalPartnerPillLabel(
  booking: AdminBooking,
): string | null {
  if (
    !booking.selectedProvider ||
    bookingSelectedPartnerIdForChoice(booking) === bookingPreferredPartnerIdForChoice(booking)
  ) {
    return null;
  }
  return providerDisplayName(booking.selectedProvider);
}

function providerDisplayName(provider?: { readonly displayName?: string | null } | null): string {
  return marketplaceDisplayText(provider?.displayName ?? 'Partner');
}
