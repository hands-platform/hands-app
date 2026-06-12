import type { AdminBooking } from '../../lib/admin-api';

export type BookingDispatchPartnerShortcutFacts = {
  readonly cashDebt: readonly AdminBooking[];
  readonly customerSelection: readonly AdminBooking[];
  readonly firstPickWaiting: readonly AdminBooking[];
  readonly locationChecks: readonly AdminBooking[];
  readonly noPartnerSupply: readonly AdminBooking[];
  readonly openMatching: readonly AdminBooking[];
};

export type BookingDispatchPartnerShortcutBookingFact = {
  readonly booking: AdminBooking;
  readonly cashDebtNeedsOps: boolean;
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly locationNeedsOps: boolean;
  readonly marketplaceParticipantCount: number;
  readonly status: string;
};

export function bookingDispatchPartnerShortcutFacts(
  facts: readonly BookingDispatchPartnerShortcutBookingFact[],
): BookingDispatchPartnerShortcutFacts {
  const openMatching = facts.filter((fact) => fact.status === 'OPEN_MATCHING');

  return {
    cashDebt: facts.filter((fact) => fact.cashDebtNeedsOps).map((fact) => fact.booking),
    customerSelection: openMatching
      .filter((fact) => fact.customerSelectableCount > 0)
      .map((fact) => fact.booking),
    firstPickWaiting: openMatching.filter((fact) => fact.firstPickPending).map((fact) => fact.booking),
    locationChecks: facts.filter((fact) => fact.locationNeedsOps).map((fact) => fact.booking),
    noPartnerSupply: openMatching
      .filter((fact) => fact.marketplaceParticipantCount === 0)
      .map((fact) => fact.booking),
    openMatching: openMatching.map((fact) => fact.booking),
  };
}
