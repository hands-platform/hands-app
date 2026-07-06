import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingEvidencePacket as buildBookingEvidencePacket } from '../../../lib/booking-evidence-packet';
import type { BookingRefundLedgerRow } from '../../../lib/booking-refund-ledger';
import { bookingLocationTrail } from '../../../lib/booking-status-location-helpers';
import type { BookingActivityRecord } from './booking-activity-records';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingAddressSnapshotLabel,
  formatDate,
  money,
  shortId,
} from './booking-formatters';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingNotificationTrace } from './booking-notification-trace';
import { bookingPaymentEvidence } from './booking-payment-evidence';
import { latestProviderLocation } from './booking-status-location';

export type BookingDetailEvidencePacketInput = {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  bookingActivityRecords: BookingActivityRecord[];
};

export function bookingDetailEvidencePacket({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  bookingActivityRecords,
}: BookingDetailEvidencePacketInput) {
  const trail = bookingLocationTrail(booking.snapshots, latestProviderLocation(booking));
  const paymentEvidence = bookingPaymentEvidence(booking);
  const addressSnapshotLabel = bookingAddressSnapshotLabel(booking);

  return buildBookingEvidencePacket({
    chatReady: bookingChatReady(booking),
    messageCount: messages.length,
    latestMessageAtLabel: messages.length > 0 ? formatDate(messages[messages.length - 1]?.createdAt) : null,
    latestMessageAtValue: messages.length > 0 ? messages[messages.length - 1]?.createdAt : null,
    locationTrailCount: trail.length,
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    latestLocationAtValue: latestLocation?.recordedAt ?? null,
    latestLocationCoordinateLabel: latestLocationLabel(latestLocation),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentMethod: booking.payment?.method ?? 'No method',
    paymentAmountLabel: money(booking.payment?.amount, booking.payment?.currency),
    refundRows: refundLedgerRows.map((row) => ({
      status: row.status,
      amountLabel: money(row.amount, row.payment?.currency ?? undefined),
    })),
    alertCount: notificationTrace.rows.length,
    failedAlertCount: notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length,
    marketplaceBatchCount: notificationTrace.backupBatches.length,
    operatorNoteLines,
    auditLogCount: booking.auditLogs?.length ?? 0,
    opsTaskCount: booking.opsTasks?.length ?? 0,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressSnapshotLabel,
    addressPinLabel: booking.addressSnapshot ? addressSnapshotLabel : null,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    customerPriceLabel: financeTrace.customerPrice,
    walletLedgerLabel: financeTrace.walletLedger,
    refundEvidence: paymentEvidence.refundEvidence,
    activityRecordCount: bookingActivityRecords.length,
    latestActivityTitle: bookingActivityRecords[0]?.title ?? null,
    latestActivityAtLabel: bookingActivityRecords[0] ? formatDate(bookingActivityRecords[0].at) : null,
    latestActivityAtValue: bookingActivityRecords[0]?.at ?? null,
  });
}

function latestLocationLabel(latestLocation?: AdminLocationSnapshot | null) {
  if (!latestLocation) {
    return null;
  }

  const address = readAddressText(latestLocation);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}
