import type { AdminBooking } from '../../lib/admin-api';
import type { BookingMonitorCheckFlagsInput } from '../../lib/booking-monitor-check-flags';
import type { BookingPricingPolicySignal } from '../../lib/booking-pricing-policy-signal';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { providerLocationFreshness } from './booking-location-display';
import { bookingHasProviderLocation } from './booking-location-ops-inputs';

export type BookingMonitorCheckFlagsBookingFacts = {
  readonly cashDebtNeedsOps: boolean;
  readonly completedCloseoutNeedsOps: boolean;
  readonly firstPickPending: boolean;
  readonly marketplaceParticipantCount: number;
  readonly pricingPolicy: BookingPricingPolicySignal;
  readonly responseWindowExpired: boolean;
};

export type BookingMonitorCheckFlagsSignalInput = Omit<
  BookingMonitorCheckFlagsInput,
  'firstPickPending' | 'matchingChatReady' | 'matchingWindowExpired'
> & {
  readonly firstPickAwaitingDecision?: boolean;
  readonly responseWindowExpired?: boolean;
};

export function bookingMonitorCheckFlagsInput(
  input: BookingMonitorCheckFlagsSignalInput,
): BookingMonitorCheckFlagsInput {
  const { firstPickAwaitingDecision, responseWindowExpired, ...facts } = input;
  const openMatching = facts.status === 'OPEN_MATCHING';

  return {
    ...facts,
    firstPickPending: openMatching && Boolean(firstPickAwaitingDecision),
    matchingChatReady: facts.status === 'MATCHED' ? facts.hasChatRoom : true,
    matchingWindowExpired: openMatching && Boolean(responseWindowExpired),
  };
}

export function bookingMonitorCheckFlagsInputFromBooking(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMonitorCheckFlagsBookingFacts,
): BookingMonitorCheckFlagsInput {
  const providerLocationAvailable = bookingHasProviderLocation(booking);

  return bookingMonitorCheckFlagsInput({
    status: booking.status,
    hasPayment: Boolean(booking.payment),
    paymentStatus: booking.payment?.status,
    paymentProviderRef: booking.payment?.providerRef,
    completedCloseoutNeedsOps: facts.completedCloseoutNeedsOps,
    cashDebtNeedsOps: facts.cashDebtNeedsOps,
    pricingPolicy: facts.pricingPolicy,
    responseWindowExpired: facts.responseWindowExpired,
    firstPickAwaitingDecision: facts.firstPickPending,
    participantCount: facts.marketplaceParticipantCount,
    hasProviderLocation: providerLocationAvailable,
    providerLocationFreshness: providerLocationAvailable
      ? providerLocationFreshness(booking, nowMs)
      : 'missing',
    hasChatRoom: bookingMatchingChatReady(booking),
    chatMessageCount: booking.chatRoom?.messages?.length ?? 0,
  });
}
