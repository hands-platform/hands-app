import type { AdminBooking } from '../../lib/admin-api';
import type { BookingCommandDecisionStripInput } from '../../lib/booking-command-decision-strip';

type BookingCommandDecisionStripBooking = Pick<
  AdminBooking,
  'addressSnapshot' | 'chatRoom' | 'participants' | 'payment' | 'status'
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
): BookingCommandDecisionStripInput {
  return {
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressLabel: signals.addressLabel,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: signals.customerChoiceCandidateCount,
    marketplaceEligibleCount: signals.marketplaceEligibleCount,
    hasFinalPartner: signals.hasFinalPartner,
    hasChatRoom: signals.hasChatRoom,
    messageCount: booking.chatRoom?.messages?.length ?? 0,
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: signals.cashDebtNeedsSettlement,
    closeoutOpenItemCount: signals.closeoutNeedsOps ? 1 : 0,
  };
}
