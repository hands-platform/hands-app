import type { BookingCheckLevelFlag } from '../../lib/booking-check-level';
import type { AdminBooking } from '../../lib/admin-api';
import type { BookingNextActionCopyInput } from '../../lib/booking-next-action-copy';
import type { BookingNextActionOwnerInput } from './booking-next-action-owner';
import type { BookingNextOperatorActionInput } from './booking-next-operator-action';
import type { BookingNextActionPriorityInput } from './booking-next-action-priority';
import { bookingMarketplaceParticipantCount } from './booking-marketplace-count-facts';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision,
} from './booking-preferred-provider-state';

export type BookingNextActionInputReaders = {
  readonly cashDebtNeedsOps: () => boolean;
  readonly completedCloseoutNeedsOps: () => boolean;
  readonly firstPickPending: () => boolean;
  readonly flagSeverity?: BookingCheckLevelFlag['severity'] | null;
  readonly flagTitle?: string | null;
  readonly locationNeedsOps: () => boolean;
  readonly matchingChatReady: () => boolean;
  readonly paymentNeedsOps: () => boolean;
  readonly status?: string | null;
};

export function bookingNextActionPriorityInput(
  readers: BookingNextActionInputReaders,
): BookingNextActionPriorityInput {
  return {
    completedCloseoutNeedsOps: readers.completedCloseoutNeedsOps,
    flagSeverity: readers.flagSeverity,
    locationNeedsOps: readers.locationNeedsOps,
    paymentNeedsOps: readers.paymentNeedsOps,
    status: readers.status,
  };
}

export function bookingNextActionOwnerInput(
  readers: BookingNextActionInputReaders,
): BookingNextActionOwnerInput {
  return {
    completedCloseoutNeedsOps: readers.completedCloseoutNeedsOps,
    flagTitle: readers.flagTitle,
    paymentNeedsOps: readers.paymentNeedsOps,
    status: readers.status,
  };
}

export function bookingNextOperatorActionInput(
  readers: BookingNextActionInputReaders,
): BookingNextOperatorActionInput {
  return {
    cashDebtNeedsOps: readers.cashDebtNeedsOps,
    completedCloseoutNeedsOps: readers.completedCloseoutNeedsOps,
    firstPickPending: readers.firstPickPending,
    flagTitle: readers.flagTitle,
    locationNeedsOps: readers.locationNeedsOps,
    matchingChatReady: readers.matchingChatReady,
    paymentNeedsOps: readers.paymentNeedsOps,
    status: readers.status,
  };
}

export function bookingNextActionCopyInputFromBooking(
  booking: AdminBooking,
): BookingNextActionCopyInput {
  return {
    backupSelected: bookingIsBackupSelected(booking),
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    hasPayment: Boolean(booking.payment),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    paymentStatus: booking.payment?.status ?? null,
    preferredAwaitingDecision: bookingPreferredAwaitingDecision(booking),
    status: booking.status,
  };
}
