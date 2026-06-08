import type { AdminBooking } from './admin-api';
import {
  bookingCustomerSelectableParticipantsForBooking,
  bookingParticipantPartnerId,
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
} from './booking-participant-choice';
import { bookingCashDebtNeedsSettlement } from './booking-finance-flags';
import { shortId } from './admin-format';

export type MarketplaceParticipantSnapshot = {
  openMarketplaceBookings: number;
  participantRows: number;
  marketplaceRows: number;
  firstPickRows: number;
  customerSelectableRows: number;
  customerChoicePendingBookings: number;
  customerSelectedRows: number;
  declinedRows: number;
  openBookingsWithoutParticipants: number;
  cashDebtBlockedBookings: number;
  bookingsWithParticipantHistory: number;
  latestParticipantLabel: string;
  latestParticipantHref: string;
};

export function buildMarketplaceParticipantSnapshot(bookings: AdminBooking[]): MarketplaceParticipantSnapshot {
  const openMarketplaceBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length;
  const cashDebtBlockedBookings = bookings.filter((booking) =>
    bookingCashDebtNeedsSettlement({
      paymentMethod: booking.payment?.method,
      hasEarning: Boolean(booking.earning),
      earningNetAmount: booking.earning?.netAmount,
      earningStatus: booking.earning?.status,
    }),
  ).length;
  const participantRows = bookings.flatMap((booking) =>
    (booking.participants ?? []).map((participant) => ({ booking, participant })),
  );
  const marketplaceRows = participantRows.filter((row) => {
    const participantProviderId = bookingParticipantPartnerId(row.participant);
    const preferredProviderId = bookingPreferredPartnerIdForChoice(row.booking);
    return Boolean(participantProviderId) && participantProviderId !== preferredProviderId;
  });
  const firstPickRows = participantRows.filter((row) => {
    const participantProviderId = bookingParticipantPartnerId(row.participant);
    const preferredProviderId = bookingPreferredPartnerIdForChoice(row.booking);
    return Boolean(participantProviderId && preferredProviderId) && participantProviderId === preferredProviderId;
  });
  const dedupedCustomerSelectableRows = bookings.reduce(
    (sum, booking) => sum + bookingCustomerSelectableParticipantsForBooking(booking).length,
    0,
  );
  const customerChoicePendingBookings = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      !bookingSelectedPartnerIdForChoice(booking) &&
      bookingCustomerSelectableParticipantsForBooking(booking).length > 0,
  ).length;
  const customerSelectedRows = participantRows.filter(
    (row) =>
      row.participant.status === 'SELECTED' ||
      Boolean(
        bookingSelectedPartnerIdForChoice(row.booking) &&
          bookingParticipantPartnerId(row.participant) === bookingSelectedPartnerIdForChoice(row.booking),
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
    openMarketplaceBookings,
    participantRows: participantRows.length,
    marketplaceRows: marketplaceRows.length,
    firstPickRows: firstPickRows.length,
    customerSelectableRows: dedupedCustomerSelectableRows,
    customerChoicePendingBookings,
    customerSelectedRows: customerSelectedRows.length,
    declinedRows: declinedRows.length,
    openBookingsWithoutParticipants,
    cashDebtBlockedBookings,
    bookingsWithParticipantHistory,
    latestParticipantLabel: latest
      ? `${bookingServiceLabelForSnapshot(latest.booking)} / ${shortId(latest.booking.id, { fallback: 'unknown' })}`
      : 'No participant row',
    latestParticipantHref: latest ? `/bookings/${latest.booking.id}#participants` : '/bookings?view=marketplace',
  };
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
