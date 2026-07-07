import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  addressLabel,
  approximateDistanceMeters,
  bookingAddressSnapshotLabel,
  distanceLabel,
  isTerminalPayment,
} from './booking-formatters';
import {
  latestProviderLocation,
  latestProviderLocationFreshness,
} from './booking-status-location';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';

export type BookingLiveServiceSignal = {
  label: string;
  value: string;
  helper: string;
  tone: string;
};

export function bookingLiveServiceSignals(booking: AdminBookingDetail): BookingLiveServiceSignal[] {
  const latest = latestProviderLocation(booking);
  const freshness = latestProviderLocationFreshness(booking);
  const serviceAddressValue = serviceAddressLocationLabel(booking);
  const providerLocationValue = latest ? latestLocationLabel(latest) : 'No Partner location';
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
      label: 'Service address',
      value: serviceAddressValue,
      helper: booking.addressSnapshot ? 'Service address record saved.' : 'Stored booking address fallback.',
      tone: booking.addressSnapshot || (booking.lat && booking.lng) ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Partner location',
      value: providerLocationValue,
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
      helper: 'Calculated from the service address and latest Partner location. It is not a route or ETA.',
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

function serviceAddressLocationLabel(booking: AdminBookingDetail) {
  const address = booking.addressSnapshot
    ? bookingAddressSnapshotLabel(booking)
    : addressLabel(booking.address);

  return address === 'Address pending' || address === 'No pin'
    ? 'No service address location'
    : address;
}

function latestLocationLabel(latest: NonNullable<ReturnType<typeof latestProviderLocation>>) {
  const address = readAddressText(latest);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}
