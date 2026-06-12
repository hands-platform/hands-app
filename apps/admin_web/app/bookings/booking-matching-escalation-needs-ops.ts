import type { AdminBooking } from '../../lib/admin-api';

export type BookingMatchingEscalationNeedsOpsFacts = {
  readonly hasChatRoom: boolean;
  readonly responseWindowExpired: boolean;
};

export function bookingMatchingEscalationNeedsOps(
  booking: Pick<AdminBooking, 'status'>,
  facts: BookingMatchingEscalationNeedsOpsFacts,
): boolean {
  if (booking.status === 'OPEN_MATCHING') {
    return true;
  }
  if (booking.status === 'MATCHED' && !facts.hasChatRoom) {
    return true;
  }
  return facts.responseWindowExpired;
}
