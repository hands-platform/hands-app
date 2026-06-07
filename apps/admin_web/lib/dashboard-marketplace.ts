import type { AdminBooking } from './admin-api';
import {
  bookingParticipantPartnerId,
  isCustomerSelectableBookingParticipant,
} from './booking-participant-choice';
import { shortId } from './admin-format';

export type MarketplaceParticipantSnapshot = {
  participantRows: number;
  marketplaceRows: number;
  firstPickRows: number;
  customerSelectableRows: number;
  customerSelectedRows: number;
  declinedRows: number;
  openBookingsWithoutParticipants: number;
  bookingsWithParticipantHistory: number;
  latestParticipantLabel: string;
  latestParticipantHref: string;
};

export function buildMarketplaceParticipantSnapshot(bookings: AdminBooking[]): MarketplaceParticipantSnapshot {
  const participantRows = bookings.flatMap((booking) =>
    (booking.participants ?? []).map((participant) => ({ booking, participant })),
  );
  const marketplaceRows = participantRows.filter((row) => {
    const participantProviderId = bookingParticipantPartnerId(row.participant);
    const preferredProviderId = preferredProviderIdForSnapshot(row.booking);
    return Boolean(participantProviderId) && participantProviderId !== preferredProviderId;
  });
  const firstPickRows = participantRows.filter((row) => {
    const participantProviderId = bookingParticipantPartnerId(row.participant);
    const preferredProviderId = preferredProviderIdForSnapshot(row.booking);
    return Boolean(participantProviderId && preferredProviderId) && participantProviderId === preferredProviderId;
  });
  const customerSelectableRows = participantRows.filter((row) =>
    isCustomerSelectableParticipantForSnapshot(row.booking, row.participant),
  );
  const customerSelectedRows = participantRows.filter(
    (row) =>
      row.participant.status === 'SELECTED' ||
      Boolean(
        row.booking.selectedProviderId &&
          bookingParticipantPartnerId(row.participant) === row.booking.selectedProviderId,
      ),
  );
  const declinedRows = participantRows.filter((row) => row.participant.status === 'REJECTED');
  const openBookingsWithoutParticipants = bookings.filter(
    (booking) => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
  ).length;
  const bookingsWithParticipantHistory = bookings.filter((booking) => (booking.participants?.length ?? 0) > 0)
    .length;
  const latest = participantRows.sort(
    (left, right) => participantSnapshotTime(right.participant) - participantSnapshotTime(left.participant),
  )[0];

  return {
    participantRows: participantRows.length,
    marketplaceRows: marketplaceRows.length,
    firstPickRows: firstPickRows.length,
    customerSelectableRows: customerSelectableRows.length,
    customerSelectedRows: customerSelectedRows.length,
    declinedRows: declinedRows.length,
    openBookingsWithoutParticipants,
    bookingsWithParticipantHistory,
    latestParticipantLabel: latest
      ? `${bookingServiceLabelForSnapshot(latest.booking)} / ${shortId(latest.booking.id, { fallback: 'unknown' })}`
      : 'No participant row',
    latestParticipantHref: latest ? `/bookings/${latest.booking.id}#participants` : '/bookings?view=marketplace',
  };
}

function preferredProviderIdForSnapshot(booking: AdminBooking) {
  return booking.preferredProviderId ?? booking.preferredProvider?.id ?? null;
}

function isCustomerSelectableParticipantForSnapshot(
  booking: AdminBooking,
  participant: NonNullable<AdminBooking['participants']>[number],
) {
  return isCustomerSelectableBookingParticipant(participant, preferredProviderIdForSnapshot(booking));
}

function participantSnapshotTime(participant: NonNullable<AdminBooking['participants']>[number]) {
  const timestamp = Date.parse(participant.respondedAt ?? participant.joinedAt ?? '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function bookingServiceLabelForSnapshot(booking: AdminBooking) {
  const service = booking.services?.[0];
  const name = service?.service?.name ?? 'Booking';
  const duration = service?.service?.durationMin ? `${service.service.durationMin} min` : null;
  return duration ? `${name} (${duration})` : name;
}
