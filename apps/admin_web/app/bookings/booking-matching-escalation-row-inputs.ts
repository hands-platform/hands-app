import type { AdminBooking } from '../../lib/admin-api';
import type { BookingMatchingEscalationRowInput } from '../../lib/booking-matching-escalation-rows';
import { bookingTimestamp } from './booking-list-time';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingMatchingEscalationNeedsOps } from './booking-matching-escalation-needs-ops';
import {
  bookingMatchingWindowExpired,
  bookingMatchingWindowLabel,
} from './booking-matching-window';

export type BookingMatchingEscalationRowFacts = {
  readonly hasChatRoom: boolean;
  readonly marketplaceCount: number;
  readonly preferredAwaitingDecision: boolean;
  readonly responseWindowExpired: boolean;
  readonly selectableCount: number;
  readonly selectionLabel: string;
  readonly selectionPathLabel: string;
  readonly windowLabel: string;
};

export type BookingMatchingEscalationRowBookingFacts = Omit<
  BookingMatchingEscalationRowFacts,
  'hasChatRoom' | 'responseWindowExpired' | 'windowLabel'
>;

export function bookingMatchingEscalationRowInput(
  booking: AdminBooking,
  facts: BookingMatchingEscalationRowFacts,
): BookingMatchingEscalationRowInput<AdminBooking> {
  return {
    booking,
    hasChatRoom: facts.hasChatRoom,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    marketplaceCount: facts.marketplaceCount,
    needsOps: bookingMatchingEscalationNeedsOps(booking, {
      hasChatRoom: facts.hasChatRoom,
      responseWindowExpired: facts.responseWindowExpired,
    }),
    preferredAwaitingDecision: facts.preferredAwaitingDecision,
    responseWindowExpired: facts.responseWindowExpired,
    selectableCount: facts.selectableCount,
    selectionLabel: facts.selectionLabel,
    selectionPathLabel: facts.selectionPathLabel,
    sortTimestamp: bookingTimestamp(booking),
    status: booking.status,
    windowLabel: facts.windowLabel,
  };
}

export function bookingMatchingEscalationRowInputFromBooking(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMatchingEscalationRowBookingFacts,
): BookingMatchingEscalationRowInput<AdminBooking> {
  return bookingMatchingEscalationRowInput(booking, {
    ...facts,
    hasChatRoom: bookingMatchingChatReady(booking),
    responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
    windowLabel: bookingMatchingWindowLabel(booking, nowMs),
  });
}
