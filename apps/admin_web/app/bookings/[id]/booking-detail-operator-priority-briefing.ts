import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { bookingOperatorPriorityBriefing as buildBookingOperatorPriorityBriefing } from '../../../lib/booking-operator-priority-briefing';
import type { BookingOperatorCommandQueue } from '../../../lib/booking-operator-command-queue';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingAddressSnapshotLabel, coordinateLabel } from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingOperatingNextAction } from './booking-operating-next-action';
import { bookingPartnerHint } from '../../../lib/booking-partner-decision-copy';
import {
  bookingDetailProviderLocationMetricHelper,
  bookingDetailProviderLocationMetricValue,
} from './booking-provider-location-metric';

export type BookingDetailOperatorPriorityBriefingInput = {
  booking: AdminBookingDetail;
  operatorCommandQueue: BookingOperatorCommandQueue;
  closeoutReadiness: {
    status: string;
    helper: string;
    openItems: readonly unknown[];
  };
  financeFlags: readonly AttentionFlag[];
  latestLocation?: AdminLocationSnapshot | null;
  messageCount: number;
};

const activeLocationStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingDetailOperatorPriorityBriefing({
  booking,
  operatorCommandQueue,
  closeoutReadiness,
  financeFlags,
  latestLocation,
  messageCount,
}: BookingDetailOperatorPriorityBriefingInput) {
  const primaryCommand = operatorCommandQueue.commands[0];
  const nextAction = bookingOperatingNextAction(booking);
  const finalPartner = bookingFinalPartnerSummary(booking);
  const participantCount = booking.participants?.length ?? 0;
  const customerName = booking.customerProfile?.user?.fullName ?? 'Customer';
  const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
  const partnerLabel = finalPartner.selected ? finalPartner.label : 'Not selected';
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const locationLabel = latestLocation
    ? bookingDetailProviderLocationMetricValue(booking)
    : activeLocationStatuses.has(booking.status)
      ? 'Missing'
      : 'Not required yet';

  return buildBookingOperatorPriorityBriefing({
    primaryCommand,
    nextAction,
    customerName,
    customerPhone,
    addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
    partnerLabel,
    hasFinalPartner: finalPartner.selected,
    participantCount,
    partnerHint: bookingPartnerHint(booking),
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount,
    locationLabel,
    locationHelper: latestLocation
      ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${bookingDetailProviderLocationMetricHelper(booking)}`
      : bookingDetailProviderLocationMetricHelper(booking),
    paymentLabel,
    paymentHint: bookingPaymentHint(booking, {
      cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    }),
    closeoutStatus: closeoutReadiness.status,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemCount: closeoutReadiness.openItems.length,
    financeFlagTitles: financeFlags.map((flag) => flag.title),
  });
}
