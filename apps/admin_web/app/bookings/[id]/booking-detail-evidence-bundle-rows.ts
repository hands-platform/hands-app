import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingEvidenceBundleRows as buildBookingEvidenceBundleRowsFromFacts } from '../../../lib/booking-evidence-bundle-rows';
import type { BookingActivityRecord } from './booking-activity-records';
import { bookingChatRepairNeedsOps } from './booking-chat-repair-state';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingAddressSnapshotLabel,
  formatDate,
  shortId,
} from './booking-formatters';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import type { bookingFinanceTrace } from './booking-finance-trace';
import { bookingDispatchPin } from './booking-marketplace-supply';
import type { bookingNotificationTrace } from './booking-notification-trace';
import { bookingDetailProviderLocationMetricValue } from './booking-provider-location-metric';

export type BookingDetailEvidenceBundleRowsInput = {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation: AdminLocationSnapshot | null;
  locationTrailCount: number;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerCount: number;
  operatorNoteLines: readonly string[];
  bookingActivityRecords: BookingActivityRecord[];
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  customerChoiceCandidates: number;
  failedAlertCount: number;
  chatReady: boolean;
};

export function bookingDetailEvidenceBundleRows({
  booking,
  messages,
  latestLocation,
  locationTrailCount,
  notificationTrace,
  financeTrace,
  refundLedgerCount,
  operatorNoteLines,
  bookingActivityRecords,
  finalPartnerSummary,
  customerChoiceCandidates,
  failedAlertCount,
  chatReady,
}: BookingDetailEvidenceBundleRowsInput) {
  const latestActivity = bookingActivityRecords[0];
  const latestMessage = messages[messages.length - 1];
  const dispatchPin = bookingDispatchPin(booking);
  const addressSnapshotLabel = bookingAddressSnapshotLabel(booking);

  return buildBookingEvidenceBundleRowsFromFacts({
    bookingId: booking.id,
    customerProfileId: booking.customerProfile?.id ?? null,
    customerRecordLabel: booking.customerProfile?.id ? shortId(booking.customerProfile.id) : 'Profile missing',
    customerEvidenceLabel: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
      booking.customerProfile?.user?.phone ?? 'No phone'
    }`,
    addressReady: Boolean(booking.addressSnapshot),
    addressLabel: addressSnapshotLabel,
    addressSourceLabel: dispatchPin.source,
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    finalPartnerRecordLabel: finalPartnerSummary.id ? shortId(finalPartnerSummary.id) : 'Selection pending',
    finalPartnerEvidenceLabel: finalPartnerSummary.selected
      ? `${finalPartnerSummary.label} / ${bookingDetailProviderLocationMetricValue(booking)}`
      : null,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidates,
    chatReady,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    chatMessageCount: messages.length,
    latestChatMessageAtLabel: latestMessage?.createdAt ? formatDate(latestMessage.createdAt) : null,
    latestChatMessageAtValue: latestMessage?.createdAt ?? null,
    chatRepairNeeded: bookingChatRepairNeedsOps(booking),
    hasMoneyTrace: Boolean(booking.payment || booking.earning || refundLedgerCount),
    paymentShortId: booking.payment?.id ? shortId(booking.payment.id) : null,
    moneyStatus: booking.payment?.status ?? booking.earning?.status ?? 'Trace loaded',
    paymentMethod: booking.payment?.method ?? 'NONE',
    customerPriceLabel: financeTrace.customerPrice,
    partnerPayoutLabel: financeTrace.providerPayout,
    walletLedgerLabel: financeTrace.walletLedger,
    hasLocationTrace: Boolean(latestLocation || locationTrailCount),
    latestLocationShortId: latestLocation ? shortId(latestLocation.id) : null,
    locationStatusLabel: bookingDetailProviderLocationMetricValue(booking),
    latestLocationEvidenceLabel: latestLocationEvidenceLabel(latestLocation),
    latestLocationEvidenceDateTimeValue: latestLocation?.recordedAt ?? null,
    serviceAddressPinLabel: addressSnapshotLabel,
    notificationCount: notificationTrace.rows.length,
    failedAlertCount,
    partnerAlertCount: notificationTrace.rows.filter((row) => row.isPartnerAlert).length,
    marketplaceBatchCount: notificationTrace.backupBatches.length,
    activityRecordCount: bookingActivityRecords.length,
    latestActivityEvidenceLabel: latestActivity
      ? `${latestActivity.title} / ${formatDate(latestActivity.at)}`
      : null,
    latestActivityEvidenceDateTimeValue: latestActivity?.at ?? null,
    latestOperatorNote: operatorNoteLines[operatorNoteLines.length - 1] ?? null,
  });
}

function latestLocationEvidenceLabel(latestLocation: AdminLocationSnapshot | null) {
  if (!latestLocation) {
    return null;
  }

  const address = readAddressText(latestLocation);
  const locationLabel = address
    ? serviceAddressAreaLabel(address)
    : 'Location recorded without readable address';

  return `${locationLabel} / ${formatDate(latestLocation.recordedAt)}`;
}
