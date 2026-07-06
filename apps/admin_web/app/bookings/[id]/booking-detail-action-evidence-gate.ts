import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingActionEvidenceGate as buildBookingActionEvidenceGateFromFacts } from '../../../lib/booking-action-evidence-gate';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import { canExpireBooking, canMarkNoShow } from '../../../lib/booking-operator-action-rules';
import { formatDate, isTerminalPayment } from './booking-formatters';
import type { bookingNotificationTrace } from './booking-notification-trace';

export type BookingDetailActionEvidenceGateInput = {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  operatorNoteLines: readonly string[];
  refundLedgerCount: number;
  cashDebt: boolean;
  closeoutReadiness: {
    helper: string;
    openItems: Array<{ label: string }>;
    status: string;
    tone: string;
  };
};

export function bookingDetailActionEvidenceGate({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  operatorNoteLines,
  refundLedgerCount,
  cashDebt,
  closeoutReadiness,
}: BookingDetailActionEvidenceGateInput) {
  const manualOutcomeEvidenceLabel = [
    messages.length ? `${messages.length} chat message(s)` : null,
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : null,
    notificationTrace.rows.length ? `${notificationTrace.rows.length} alert row(s)` : null,
    operatorNoteLines.length ? `${operatorNoteLines.length} operator note(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return buildBookingActionEvidenceGateFromFacts({
    bookingStatus: booking.status,
    paymentExists: Boolean(booking.payment?.id),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentProviderRef: booking.payment?.providerRef ?? null,
    paymentMethod: booking.payment?.method ?? null,
    paymentIsTerminal: isTerminalPayment(booking.payment?.status ?? 'NONE'),
    hasChatArchive: Boolean(booking.chatRoom),
    hasDecisionEvidence: Boolean(
      messages.length ||
        latestLocation ||
        notificationTrace.rows.length ||
        operatorNoteLines.length ||
        booking.auditLogs?.length,
    ),
    manualOutcomeEvidenceLabel,
    refundLedgerCount,
    cashDebt,
    closeoutAvailable: canCloseoutCompletedBooking(booking),
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    closeoutHelper: closeoutReadiness.helper,
    completedCloseoutLabel: completedCloseoutLabel(booking),
    completedCloseoutTone: completedCloseoutTone(booking),
    expireAvailable: canExpireBooking(booking.status),
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    expiresAtLabel: formatDate(booking.expiresAt),
    expiresAtValue: booking.expiresAt,
    noShowAvailable: canMarkNoShow(booking.status),
  });
}
