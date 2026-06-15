import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingDecisionNotePresets as buildBookingDecisionNotePresets } from '../../../lib/booking-decision-note-presets';
import { bookingFinalGateReason as buildBookingFinalGateReasonFromFacts } from '../../../lib/booking-final-gate-reason';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingPreferredAwaitingDecision } from './booking-preferred-decision';

export type BookingDetailGateAndNotesInput = {
  booking: AdminBookingDetail;
  latestLocation: AdminLocationSnapshot | null;
  messageCount: number;
  notificationCount: number;
  operatorNoteCount: number;
  refundRowCount: number;
  customerChoiceCandidates: number;
  marketplaceParticipants: number;
  walletLedgerLabel: string;
  closeoutOpenItemLabels: string[];
};

export function bookingDetailGateAndNotes({
  booking,
  latestLocation,
  messageCount,
  notificationCount,
  operatorNoteCount,
  refundRowCount,
  customerChoiceCandidates,
  marketplaceParticipants,
  walletLedgerLabel,
  closeoutOpenItemLabels,
}: BookingDetailGateAndNotesInput) {
  const cashFeeDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const finalPartnerSummary = bookingFinalPartnerSummary(booking);

  return {
    finalGateReason: buildBookingFinalGateReasonFromFacts({
      cashDebt: cashFeeDebtNeedsSettlement,
      walletLedgerLabel,
      hasAddressSnapshot: Boolean(booking.addressSnapshot),
      bookingStatus: booking.status,
      hasPreferredPartner: Boolean(booking.preferredProvider),
      preferredAwaitingDecision: bookingPreferredAwaitingDecision(booking),
      customerChoiceCandidates,
      marketplaceParticipants,
      selected: finalPartnerSummary.selected,
      hasChatRoom: Boolean(booking.chatRoom),
    }),
    decisionNotePresets: buildBookingDecisionNotePresets({
      bookingStatus: booking.status,
      messageCount,
      hasLatestLocation: Boolean(latestLocation),
      notificationCount,
      operatorNoteCount,
      paymentMethod: booking.payment?.method ?? 'NONE',
      paymentStatus: booking.payment?.status ?? 'NONE',
      refundRowCount,
      cashFeeDebtNeedsSettlement,
      closeoutOpenItemLabels,
    }),
  };
}
