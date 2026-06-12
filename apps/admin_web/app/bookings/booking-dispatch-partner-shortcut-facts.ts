import type { AdminBooking } from '../../lib/admin-api';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import { bookingLocationNeedsOpsInput } from './booking-location-ops-inputs';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';

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

export type BookingDispatchPartnerShortcutBookingFactInput = {
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly marketplaceParticipantCount: number;
};

export function bookingDispatchPartnerShortcutBookingFact(
  booking: AdminBooking,
  nowMs: number,
  input: BookingDispatchPartnerShortcutBookingFactInput,
): BookingDispatchPartnerShortcutBookingFact {
  const open = booking.status === 'OPEN_MATCHING';

  return {
    booking,
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    customerSelectableCount: open ? input.customerSelectableCount : 0,
    firstPickPending: open ? input.firstPickPending : false,
    locationNeedsOps: bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs)),
    marketplaceParticipantCount: open ? input.marketplaceParticipantCount : 0,
    status: booking.status,
  };
}

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
