import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingCloseoutChecklistRows as buildBookingCloseoutChecklistRowsFromFacts } from '../../../lib/booking-closeout-checklist-rows';
import type { BookingActivityRecord } from './booking-activity-records';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import { bookingAddressSnapshotLabel, formatDate, shortId } from './booking-formatters';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingNotificationTrace } from './booking-notification-trace';

const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export type BookingDetailCloseoutChecklistInput = {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerCount: number;
  refundEvidence: string;
  operatorNoteLines: readonly string[];
  bookingActivityRecords: BookingActivityRecord[];
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  customerChoiceCandidates: number;
  failedAlertCount: number;
  chatReady: boolean;
  cashFeeDebtNeedsSettlement: boolean;
  closeoutReadiness: {
    helper: string;
    openItems: Array<{ label: string }>;
    status: string;
    tone: string;
  };
};

export function bookingDetailCloseoutChecklist({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerCount,
  refundEvidence,
  operatorNoteLines,
  bookingActivityRecords,
  finalPartnerSummary,
  customerChoiceCandidates,
  failedAlertCount,
  chatReady,
  cashFeeDebtNeedsSettlement,
  closeoutReadiness,
}: BookingDetailCloseoutChecklistInput) {
  const latestMessage = messages[messages.length - 1];

  return buildBookingCloseoutChecklistRowsFromFacts({
    bookingId: booking.id,
    bookingStatus: booking.status,
    addressReady: Boolean(booking.addressSnapshot),
    addressLabel: bookingAddressSnapshotLabel(booking),
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    finalPartnerLabel: finalPartnerSummary.selected ? finalPartnerSummary.label : null,
    customerChoiceCandidates,
    chatNeeded: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
      booking.status,
    ),
    chatReady,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    chatMessageCount: messages.length,
    latestMessageAtLabel: latestMessage ? formatDate(latestMessage.createdAt) : null,
    latestMessageAtValue: latestMessage?.createdAt ?? null,
    cashDebt: cashFeeDebtNeedsSettlement,
    paymentStatus: booking.payment?.status ?? null,
    paymentMethod: booking.payment?.method ?? 'NONE',
    customerPriceLabel: financeTrace.customerPrice,
    partnerPayoutLabel: financeTrace.providerPayout,
    walletLedgerLabel: financeTrace.walletLedger,
    terminal: terminalBookingStatuses.has(booking.status),
    refundLedgerCount,
    refundEvidence,
    alertCount: notificationTrace.rows.length,
    failedAlertCount,
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    taxRows: booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0,
    operatorTrailCount: operatorNoteLines.length + bookingActivityRecords.length + (booking.auditLogs?.length ?? 0),
    latestLocationLabel: latestCloseoutLocationLabel(latestLocation),
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    latestLocationAtValue: latestLocation?.recordedAt ?? null,
    notificationCount: notificationTrace.rows.length,
  });
}

function latestCloseoutLocationLabel(latestLocation: AdminLocationSnapshot | null) {
  if (!latestLocation) {
    return null;
  }

  const address = readAddressText(latestLocation);
  const locationLabel = address
    ? serviceAddressAreaLabel(address)
    : 'Location recorded without readable address';
  return locationLabel;
}
