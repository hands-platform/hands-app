import type { AdminBooking } from '../../lib/admin-api';

const CHAT_HANDOFF_REQUIRED_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function bookingNeedsChatHandoffEvidence(booking: AdminBooking) {
  return CHAT_HANDOFF_REQUIRED_STATUSES.has(booking.status) && !booking.chatRoom?.id;
}

export function bookingNeedsCloseoutEvidence(booking: AdminBooking) {
  return (
    booking.status === 'COMPLETED' &&
    (!booking.payment || !booking.earning || !booking.chatRoom?.id)
  );
}

export function bookingsMissingChatHandoffEvidence(bookings: readonly AdminBooking[]) {
  return bookings.filter(bookingNeedsChatHandoffEvidence);
}

export function bookingsMissingCloseoutEvidence(bookings: readonly AdminBooking[]) {
  return bookings.filter(bookingNeedsCloseoutEvidence);
}
