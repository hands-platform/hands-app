import type { AdminBooking } from '../../lib/admin-api';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import {
  bookingPaymentNeedsOpsFromFacts,
} from '../../lib/booking-payment-ops';
import type { BookingActionPriority, BookingCommandTone } from './booking-command-display';
import {
  bookingCheckFlagSeverityWeight,
  bookingNextActionPriorityFromFacts,
} from './booking-next-action-priority';
import {
  bookingNextActionOwnerInput,
  bookingNextActionPriorityInput,
  bookingNextOperatorActionInput,
  type BookingNextActionInputReaders,
} from './booking-next-action-inputs';
import {
  bookingNextActionOwnerFromFacts,
  type BookingNextActionOwner,
} from './booking-next-action-owner';
import { orderedBookingNextActions } from './booking-next-action-order';
import { bookingNextOperatorActionFromFacts } from './booking-next-operator-action';
import { bookingTimestamp } from './booking-list-time';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';
import { bookingMonitorNextActionLabel } from './booking-monitor-next-action-label';
import { bookingMonitorSelectionLabelForBooking } from './booking-monitor-selection-model';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingLocationNeedsOpsInput } from './booking-location-ops-inputs';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import { bookingPaymentNeedsOpsInput } from './booking-payment-ops-inputs';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export type BookingMonitorNextActionItem = {
  readonly booking: AdminBooking;
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly owner: BookingNextActionOwner;
  readonly priority: BookingActionPriority;
  readonly tags: readonly string[];
  readonly title: string;
  readonly tone: BookingCommandTone;
};

type BookingMonitorCheckFlag = ReturnType<typeof bookingMonitorCheckFlags>[number];

export function buildBookingMonitorNextActions(
  bookings: readonly AdminBooking[],
  nowMs: number,
): BookingMonitorNextActionItem[] {
  return orderedBookingNextActions(
    bookings
      .map((booking) => bookingNextActionCandidate(booking, nowMs))
      .filter((item): item is BookingMonitorNextActionItem => Boolean(item)),
    (action) => bookingTimestamp(action.booking),
  );
}

function bookingNextActionCandidate(
  booking: AdminBooking,
  nowMs: number,
): BookingMonitorNextActionItem | null {
  const highestFlag = highestBookingCheckFlag(booking, nowMs);
  if (highestFlag) {
    return bookingFlagNextAction(booking, nowMs, highestFlag);
  }

  return null;
}

function highestBookingCheckFlag(booking: AdminBooking, nowMs: number) {
  return [...bookingMonitorCheckFlags(booking, nowMs)].sort(
    (left, right) =>
      bookingCheckFlagSeverityWeight(right.severity) -
      bookingCheckFlagSeverityWeight(left.severity),
  )[0];
}

function bookingFlagNextAction(
  booking: AdminBooking,
  nowMs: number,
  highestFlag: BookingMonitorCheckFlag,
): BookingMonitorNextActionItem {
  return {
    booking,
    title: highestFlag.title,
    detail: bookingMonitorNextActionLabel(booking),
    operatorAction: bookingOperatorAction(booking, nowMs, highestFlag),
    owner: bookingActionOwner(booking, nowMs, highestFlag),
    priority: bookingActionPriority(booking, nowMs, highestFlag),
    tone: highestFlag.severity === 'high' ? 'danger' : highestFlag.severity === 'medium' ? 'warn' : 'info',
    href: `/bookings/${booking.id}`,
    tags: bookingFlagNextActionTags(booking),
  };
}

function bookingFlagNextActionTags(booking: AdminBooking) {
  return [
    booking.payment?.method ? `payment ${booking.payment.method}` : 'payment missing',
    booking.chatRoom ? 'chat ready' : 'chat pending',
    bookingMonitorSelectionLabelForBooking(booking),
  ];
}

function bookingActionPriority(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingMonitorCheckFlag,
): BookingMonitorNextActionItem['priority'] {
  return bookingNextActionPriorityFromFacts(
    bookingNextActionPriorityInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingActionOwner(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingMonitorCheckFlag,
): BookingMonitorNextActionItem['owner'] {
  return bookingNextActionOwnerFromFacts(
    bookingNextActionOwnerInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingOperatorAction(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingMonitorCheckFlag,
) {
  return bookingNextOperatorActionFromFacts(
    bookingNextOperatorActionInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingNextActionReaders(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingMonitorCheckFlag,
): BookingNextActionInputReaders {
  return {
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    completedCloseoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    firstPickPending: () => bookingFirstPickPending(booking),
    flagSeverity: flag?.severity,
    flagTitle: flag?.title,
    locationNeedsOps: () => bookingNextActionLocationNeedsOps(booking, nowMs),
    matchingChatReady: () => bookingMatchingChatReady(booking),
    paymentNeedsOps: () => bookingNextActionPaymentNeedsOps(booking),
    status: booking.status,
  };
}

function bookingNextActionLocationNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs));
}

function bookingNextActionPaymentNeedsOps(booking: AdminBooking) {
  return bookingPaymentNeedsOpsFromFacts(
    bookingPaymentNeedsOpsInput({
      booking,
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    }),
  );
}
