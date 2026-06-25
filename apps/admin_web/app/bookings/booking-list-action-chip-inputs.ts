import type { AdminBooking } from '../../lib/admin-api';
import { formatMoney as money } from '../../lib/admin-format';
import { bookingChatListStateFromFacts } from '../../lib/booking-chat-list-state';
import {
  bookingListActionChipsFromFacts,
  type BookingListActionChip,
  type BookingListActionChipsInput,
} from '../../lib/booking-list-action-chips';
import { bookingPaymentNeedsOpsFromFacts } from '../../lib/booking-payment-ops';
import { bookingPricingPolicySignalFromFacts } from '../../lib/booking-pricing-policy-signal';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import {
  bookingChatRepairNeedsOps,
  bookingMatchingChatReady,
} from './booking-chat-handoff-state';
import { bookingChatMessageCount } from './booking-chat-message-count';
import { bookingLocationSignalLabel } from './booking-location-display';
import { bookingLocationNeedsOpsInput } from './booking-location-ops-inputs';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import { bookingPaymentNeedsOpsInput } from './booking-payment-ops-inputs';
import { bookingPricingPolicySignalInput } from './booking-pricing-policy-inputs';

export function bookingListActionChipsInput(
  booking: AdminBooking,
  nowMs: number,
): BookingListActionChipsInput {
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);
  const closeoutNeedsOps = bookingCompletedCloseoutNeedsOps(booking);
  const pricingPolicy = bookingPricingPolicySignalFromFacts(
    bookingPricingPolicySignalInput(booking),
  );

  return {
    cashDebtNeedsOps,
    chatNeedsRepair: bookingChatRepairNeedsOps(booking),
    chatState: bookingChatListStateFromFacts({
      status: booking.status,
      hasChatRoom: bookingMatchingChatReady(booking),
      messageCount: bookingChatMessageCount(booking),
    }),
    closeoutNeedsOps,
    locationDetail: bookingLocationSignalLabel(booking, nowMs),
    locationNeedsOps: bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs)),
    paymentDetail: booking.payment
      ? `${booking.payment.method} / ${booking.payment.status} / ${money(
          Number(booking.payment.amount ?? 0),
          booking.payment.currency,
        )}`
      : 'No payment record is attached to this booking.',
    paymentNeedsOps: bookingPaymentNeedsOpsFromFacts(
      bookingPaymentNeedsOpsInput({
        booking,
        cashDebtNeedsOps,
        completedCloseoutNeedsOps: closeoutNeedsOps,
      }),
    ),
    pricingDetail: pricingPolicy.label,
    pricingNeedsOps: pricingPolicy.status !== 'ready',
    pricingTone: pricingPolicy.tone,
  };
}

export function bookingListActionChips(
  booking: AdminBooking,
  nowMs: number,
): readonly BookingListActionChip[] {
  return bookingListActionChipsFromFacts(bookingListActionChipsInput(booking, nowMs));
}
