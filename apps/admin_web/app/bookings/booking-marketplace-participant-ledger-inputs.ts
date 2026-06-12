import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import type { MarketplaceParticipantLedgerRowInput } from '../../lib/marketplace-participant-ledger';
import {
  bookingParticipantPartnerId,
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
  isCustomerSelectableBookingParticipant,
} from '../../lib/booking-participant-choice';
import {
  bookingBackupAlertTracePill,
  bookingBackupAlertTraceTone,
} from './booking-alert-trace';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingMarketplaceWalletSignal } from './booking-marketplace-wallet-signal';
import { bookingMatchingWindowLabel } from './booking-matching-window';
import {
  bookingParticipantJoinedLabel,
  bookingParticipantRespondedLabel,
  bookingParticipantTimestamp,
} from './booking-participant-time-labels';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

export function bookingMarketplaceParticipantLedgerInputs(
  booking: AdminBooking,
  nowMs: number,
  marketplaceRadiusMeters: number,
): MarketplaceParticipantLedgerRowInput<AdminBooking, BookingParticipant>[] {
  return (booking.participants ?? [])
    .filter((participant) => Boolean(participant.providerProfile?.id))
    .map((participant) =>
      bookingMarketplaceParticipantLedgerInput(
        booking,
        participant,
        nowMs,
        marketplaceRadiusMeters,
      ),
    );
}

function bookingMarketplaceParticipantLedgerInput(
  booking: AdminBooking,
  participant: BookingParticipant,
  nowMs: number,
  marketplaceRadiusMeters: number,
): MarketplaceParticipantLedgerRowInput<AdminBooking, BookingParticipant> {
  const distanceMeters = typeof participant.distanceMeters === 'number' ? participant.distanceMeters : null;
  const selectedPartnerId = bookingSelectedPartnerIdForChoice(booking);
  const participantPartnerId = bookingParticipantPartnerId(participant);
  const preferredPartnerId = bookingPreferredPartnerIdForChoice(booking);

  return {
    alertLabel: bookingBackupAlertTracePill(booking),
    alertTone: bookingBackupAlertTraceTone(booking),
    booking,
    bookingStatus: booking.status,
    customerSelectable: isCustomerSelectableBookingParticipant(participant, preferredPartnerId),
    distanceMeters,
    hasChatRoom: bookingMatchingChatReady(booking),
    joinedLabel: bookingParticipantJoinedLabel(participant, nowMs),
    marketplaceRadiusMeters,
    participant,
    participantPartnerId,
    partnerLabel: providerDisplayName(participant.providerProfile),
    preferredPartnerId,
    respondedLabel: bookingParticipantRespondedLabel(participant),
    selectedPartnerId,
    sortTimestamp: bookingParticipantTimestamp(participant),
    status: participant.status ?? 'UNKNOWN',
    ...bookingMarketplaceWalletSignal(booking),
    windowLabel: bookingMatchingWindowLabel(booking, nowMs),
  };
}

function providerDisplayName(provider?: { readonly displayName?: string | null } | null): string {
  return marketplaceDisplayText(provider?.displayName ?? 'Partner');
}
