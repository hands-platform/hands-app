import type { BookingCheckLevelFlag } from './booking-check-level';
import { bookingChatCheckFlagsFromFacts } from './booking-chat-repair-action-state';
import { bookingMatchingCheckFlagsFromFacts } from './booking-matching-check-flags';
import {
  bookingPaymentOutcomeCheckFlagsFromFacts,
  bookingPaymentReferenceCheckFlagsFromFacts,
} from './booking-payment-ops';
import {
  bookingPricingPolicyCheckFlagsFromSignal,
  type BookingPricingPolicySignal,
} from './booking-pricing-policy-signal';
import {
  bookingLocationCheckFlagsFromFacts,
  type ProviderLocationFreshness,
} from './booking-status-location-helpers';

export type BookingMonitorCheckFlagsInput = {
  readonly status?: string | null;
  readonly hasPayment?: boolean;
  readonly paymentStatus?: string | null;
  readonly paymentProviderRef?: string | null;
  readonly completedCloseoutNeedsOps?: boolean;
  readonly cashDebtNeedsOps?: boolean;
  readonly pricingPolicy: BookingPricingPolicySignal;
  readonly matchingWindowExpired?: boolean;
  readonly firstPickPending?: boolean;
  readonly participantCount?: number | null;
  readonly matchingChatReady?: boolean;
  readonly hasProviderLocation: boolean;
  readonly providerLocationFreshness: ProviderLocationFreshness;
  readonly hasChatRoom: boolean;
  readonly chatMessageCount: number;
};

export function bookingMonitorCheckFlagsFromFacts(
  input: BookingMonitorCheckFlagsInput,
): BookingCheckLevelFlag[] {
  return [
    ...bookingPaymentOutcomeCheckFlagsFromFacts({
      status: input.status,
      hasPayment: input.hasPayment,
      paymentStatus: input.paymentStatus,
      completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
      cashDebtNeedsOps: input.cashDebtNeedsOps,
    }),
    ...bookingPricingPolicyCheckFlagsFromSignal(input.pricingPolicy),
    ...bookingMatchingCheckFlagsFromFacts({
      status: input.status,
      matchingWindowExpired: input.matchingWindowExpired,
      firstPickPending: input.firstPickPending,
      participantCount: input.participantCount,
      matchingChatReady: input.matchingChatReady,
    }),
    ...bookingLocationCheckFlagsFromFacts({
      status: input.status ?? '',
      hasProviderLocation: input.hasProviderLocation,
      providerLocationFreshness: input.providerLocationFreshness,
    }),
    ...bookingChatCheckFlagsFromFacts({
      status: input.status ?? '',
      hasChatRoom: input.hasChatRoom,
      messageCount: input.chatMessageCount,
    }),
    ...bookingPaymentReferenceCheckFlagsFromFacts({
      paymentStatus: input.paymentStatus,
      paymentProviderRef: input.paymentProviderRef,
    }),
  ];
}
