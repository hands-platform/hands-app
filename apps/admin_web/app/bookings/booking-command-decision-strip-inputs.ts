import type { AdminBooking } from '../../lib/admin-api';
import type { BookingCommandDecisionStripInput } from '../../lib/booking-command-decision-strip';
import { bookingChatMessageCount } from './booking-chat-message-count';

type BookingCommandDecisionStripBooking = Pick<
  AdminBooking,
  'addressSnapshot' | 'chatRoom' | 'expiresAt' | 'participants' | 'payment' | 'status'
>;

export type BookingCommandDecisionStripInputSignals = {
  readonly addressLabel: string;
  readonly cashDebtNeedsSettlement: boolean;
  readonly closeoutNeedsOps: boolean;
  readonly customerChoiceCandidateCount: number;
  readonly hasChatRoom: boolean;
  readonly hasFinalPartner: boolean;
  readonly marketplaceEligibleCount: number;
};

export function bookingCommandDecisionStripInput(
  booking: BookingCommandDecisionStripBooking,
  signals: BookingCommandDecisionStripInputSignals,
  nowMs = Date.now(),
): BookingCommandDecisionStripInput {
  const deadlineMs = booking.expiresAt ? new Date(booking.expiresAt).getTime() : Number.NaN;
  const matchingDeadlineExpired = Number.isFinite(deadlineMs) && deadlineMs <= nowMs;

  return {
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressLabel: signals.addressLabel,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: matchingDeadlineExpired ? 0 : signals.customerChoiceCandidateCount,
    expiredCustomerChoiceCandidateCount: matchingDeadlineExpired ? signals.customerChoiceCandidateCount : 0,
    marketplaceEligibleCount: signals.marketplaceEligibleCount,
    hasFinalPartner: signals.hasFinalPartner,
    hasChatRoom: signals.hasChatRoom,
    messageCount: bookingChatMessageCount(booking),
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: signals.cashDebtNeedsSettlement,
    closeoutOpenItemCount: signals.closeoutNeedsOps ? 1 : 0,
    matchingDeadlineAt: booking.expiresAt ?? null,
    matchingDeadlineExpired,
  };
}
