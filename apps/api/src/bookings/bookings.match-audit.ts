import type { BookingMatchSource } from '../matching/matching.policy';

type BookingMatchedAuditInput = {
  actorId: string;
  action: 'booking.matched.customer_selected' | 'booking.matched.first_pick_accepted';
  bookingId: string;
  providerProfileId: string;
  matchSource: BookingMatchSource;
};

export function bookingMatchedAuditCreateInput(input: BookingMatchedAuditInput) {
  return {
    data: {
      actorId: input.actorId,
      action: input.action,
      target: `booking:${input.bookingId}`,
      metadata: {
        bookingId: input.bookingId,
        providerProfileId: input.providerProfileId,
        matchSource: input.matchSource,
      },
    },
  };
}
