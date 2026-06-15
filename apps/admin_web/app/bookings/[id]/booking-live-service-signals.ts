import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  addressLabel,
  approximateDistanceMeters,
  bookingAddressSnapshotLabel,
  coordinateLabel,
  distanceLabel,
  isTerminalPayment,
} from './booking-formatters';
import {
  latestProviderLocation,
  latestProviderLocationFreshness,
} from './booking-status-location';

export type BookingLiveServiceSignal = {
  label: string;
  value: string;
  helper: string;
  tone: string;
};

export function bookingLiveServiceSignals(booking: AdminBookingDetail): BookingLiveServiceSignal[] {
  const latest = latestProviderLocation(booking);
  const freshness = latestProviderLocationFreshness(booking);
  const serviceAddressPin = booking.addressSnapshot
    ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
    : coordinateLabel(booking.lat, booking.lng);
  const providerPin = latest ? coordinateLabel(latest.lat, latest.lng) : 'No Partner pin';
  const distanceMeters = latest
    ? approximateDistanceMeters(
        booking.addressSnapshot?.latitude ?? booking.lat,
        booking.addressSnapshot?.longitude ?? booking.lng,
        latest.lat,
        latest.lng,
      )
    : null;
  const finalPartner = bookingFinalPartnerSummary(booking);

  return [
    {
      label: 'Service address pin',
      value: serviceAddressPin,
      helper: booking.addressSnapshot
        ? bookingAddressSnapshotLabel(booking)
        : addressLabel(booking.address),
      tone: booking.addressSnapshot || (booking.lat && booking.lng) ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Partner pin',
      value: providerPin,
      helper: latest
        ? bookingProviderLocationMetricHelper(latest.recordedAt)
        : 'Ask Partner to share current location from chat.',
      tone:
        freshness === 'recent'
          ? 'pill-success'
          : freshness === 'stale'
            ? 'pill-warn'
            : freshness === 'expired'
              ? 'pill-info'
              : 'pill-danger',
    },
    {
      label: 'Approx. gap',
      value: distanceMeters === null ? 'Unknown' : distanceLabel(Math.round(distanceMeters / 100) * 100),
      helper: 'Calculated from the service address pin and latest Partner pin. It is not a route or ETA.',
      tone: distanceMeters === null ? 'pill-info' : distanceMeters > 5000 ? 'pill-warn' : 'pill-success',
    },
    {
      label: 'Service contact',
      value: booking.selectedProvider?.user?.phone ?? 'No Partner phone',
      helper: finalPartner.selected
        ? `${finalPartner.label} is the current handoff Partner.`
        : 'No Partner assigned yet.',
      tone: finalPartner.selected ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
      helper: booking.chatRoom
        ? `Room ${booking.chatRoom.id}`
        : 'Chat opens after Partner selection/service start.',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      helper: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
      tone:
        booking.payment?.status === 'AUTHORIZED'
          ? 'pill-warn'
          : isTerminalPayment(booking.payment?.status)
            ? 'pill-success'
            : 'pill-info',
    },
  ];
}
