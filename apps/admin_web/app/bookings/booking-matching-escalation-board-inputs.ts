import type { AdminBooking } from '../../lib/admin-api';
import type { BookingMatchingEscalationBoardInput } from '../../lib/booking-matching-escalation-board';

export type BookingMatchingEscalationBoardBookingFact = {
  readonly booking: AdminBooking;
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly hasChatRoom: boolean;
  readonly marketplaceParticipantCount: number;
  readonly responseWindowExpired: boolean;
  readonly status: string;
};

export function bookingMatchingEscalationBoardInput(
  facts: readonly BookingMatchingEscalationBoardBookingFact[],
): BookingMatchingEscalationBoardInput<AdminBooking> {
  const open = facts.filter((fact) => fact.status === 'OPEN_MATCHING');

  return {
    chatReady: facts.filter((fact) => fact.hasChatRoom).map((fact) => fact.booking),
    customerFinalSelection: open
      .filter((fact) => fact.customerSelectableCount > 0)
      .map((fact) => fact.booking),
    expiredWindow: open.filter((fact) => fact.responseWindowExpired).map((fact) => fact.booking),
    firstPickWaiting: open.filter((fact) => fact.firstPickPending).map((fact) => fact.booking),
    marketplaceReady: open
      .filter((fact) => fact.marketplaceParticipantCount > 0)
      .map((fact) => fact.booking),
    matchedWithoutChat: facts
      .filter((fact) => fact.status === 'MATCHED' && !fact.hasChatRoom)
      .map((fact) => fact.booking),
    noMarketplaceSupply: open
      .filter((fact) => fact.marketplaceParticipantCount === 0)
      .map((fact) => fact.booking),
  };
}
