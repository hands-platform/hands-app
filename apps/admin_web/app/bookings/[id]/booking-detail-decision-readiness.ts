import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingDecisionEvidenceGuardrails as buildBookingDecisionEvidenceGuardrails } from '../../../lib/booking-decision-evidence-guardrails';
import { bookingManualDecisionReadiness as buildBookingManualDecisionReadiness } from '../../../lib/booking-manual-decision-readiness';
import { canMarkNoShow } from '../../../lib/booking-operator-action-rules';
import type { bookingCloseoutReadiness } from './booking-closeout-readiness';
import {
  bookingAddressSnapshotLabel,
  formatDate,
  money,
  providerName,
  shortId,
} from './booking-formatters';
import type { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';

export type BookingDetailDecisionReadinessInput = {
  booking: AdminBookingDetail;
  latestLocation: AdminLocationSnapshot | null;
  messageCount: number;
  notificationCount: number;
  operatorNoteCount: number;
  refundRowCount: number;
  refundEvidence: string;
  cashFeeDebtNeedsSettlement: boolean;
  closureStatus: string;
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
};

export function bookingDetailDecisionReadiness({
  booking,
  latestLocation,
  messageCount,
  notificationCount,
  operatorNoteCount,
  refundRowCount,
  refundEvidence,
  cashFeeDebtNeedsSettlement,
  closureStatus,
  closeoutReadiness,
  financeTrace,
}: BookingDetailDecisionReadinessInput) {
  const evidenceSummary = bookingManualDecisionEvidenceSummary({
    latestLocation,
    messageCount,
    notificationCount,
    operatorNoteCount,
  });
  const closeoutOpenItemLabels = closeoutReadiness.openItems.map((item) => item.label);
  const decisionFinalPartner = bookingFinalPartnerSummary(booking);

  return {
    manualDecisionReadiness: buildBookingManualDecisionReadiness({
      bookingStatus: booking.status,
      closureStatus,
      canMarkNoShow: canMarkNoShow(booking.status),
      decisionEvidenceReady: messageCount > 0 && operatorNoteCount > 0,
      evidenceSummary,
      paymentExists: Boolean(booking.payment),
      paymentStatus: booking.payment?.status ?? 'NONE',
      paymentMethod: booking.payment?.method ?? 'NONE',
      refundRowCount,
      refundEvidence,
      cashFeeDebtNeedsSettlement,
      cashDebtEvidenceLabel: cashFeeDebtNeedsSettlement
        ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
        : `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'}`,
      closeoutStatus: closeoutReadiness.status,
      closeoutTone: closeoutReadiness.tone,
      closeoutHelper: closeoutReadiness.helper,
      closeoutOpenItemLabels,
    }),
    decisionEvidenceGuardrails: buildBookingDecisionEvidenceGuardrails({
      bookingStatus: booking.status,
      hasAddressSnapshot: Boolean(booking.addressSnapshot),
      addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
      addressPinLabel: bookingAddressSnapshotEvidenceState(booking),
      hasSelectedPartner: decisionFinalPartner.selected,
      selectedPartnerLabel: decisionFinalPartner.label,
      participantCount: booking.participants?.length ?? 0,
      preferredPartnerLabel: providerName(booking.preferredProvider),
      hasChatRoom: Boolean(booking.chatRoom),
      chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
      messageCount,
      hasLatestLocation: Boolean(latestLocation),
      latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
      latestLocationAtValue: latestLocation?.recordedAt ?? null,
      notificationCount,
      operatorNoteCount,
      hasOpsTrail: (booking.opsTasks?.length ?? 0) > 0 || (booking.auditLogs?.length ?? 0) > 0,
      paymentStatus: booking.payment?.status ?? null,
      paymentMethod: booking.payment?.method ?? null,
      paymentAmountLabel: booking.payment
        ? money(booking.payment.amount, booking.payment.currency)
        : 'No payment amount',
      refundRowCount,
      cashFeeDebtNeedsSettlement,
      platformFeeLabel: financeTrace.platformFee,
      withholdingLabel: financeTrace.withholding,
      walletLedgerLabel: financeTrace.walletLedger,
      closeoutOpenItemLabels,
      financeLedgerRowCount: bookingFinanceLedgerRowCount(booking),
      partnerPayoutLabel: financeTrace.providerPayout,
    }),
  };
}

function bookingAddressSnapshotEvidenceState(booking: AdminBookingDetail) {
  return booking.addressSnapshot ? 'confirmed service address saved' : 'No confirmed service address';
}

function bookingManualDecisionEvidenceSummary({
  latestLocation,
  messageCount,
  notificationCount,
  operatorNoteCount,
}: {
  latestLocation: AdminLocationSnapshot | null;
  messageCount: number;
  notificationCount: number;
  operatorNoteCount: number;
}) {
  return [
    messageCount > 0 ? `${messageCount} chat message(s)` : 'no chat messages',
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : 'no Partner pin',
    notificationCount > 0 ? `${notificationCount} alert row(s)` : 'no alert rows',
    operatorNoteCount > 0 ? `${operatorNoteCount} operator note(s)` : 'no operator notes',
  ].join(' / ');
}

function bookingFinanceLedgerRowCount(booking: AdminBookingDetail) {
  return (
    (booking.platformFeeLogs?.length ?? 0) +
    (booking.taxLogs?.length ?? 0) +
    (booking.walletLedgerEntries?.length ?? 0) +
    (booking.earning?.platformFeeLogs?.length ?? 0) +
    (booking.earning?.taxLogs?.length ?? 0) +
    (booking.earning?.walletLedgerEntries?.length ?? 0)
  );
}
