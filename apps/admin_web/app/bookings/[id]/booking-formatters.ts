import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatDateTime, formatMoney, shortId as formatShortId } from '../../../lib/admin-format';

export function readAmount(value: unknown) {
  return readNullableAmount(value) ?? 0;
}

export function readNullableAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function bpsAmount(amount: number, bps?: number | null) {
  return Math.round((amount * Number(bps ?? 0)) / 10000);
}

export function bookingServiceOptionLabel(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  if (!service?.name) {
    return 'Service pending';
  }

  const duration = service.durationMin ? `${service.durationMin} min` : 'duration pending';
  return `${service.name} / ${duration}`;
}

export function bookingServicePayoutRuleLabel(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  const payoutRule = service?.payoutRules?.find(
    (rule) => Number(rule.customerPrice) === Number(customerPrice),
  );

  if (!payoutRule) {
    return 'Missing active rule';
  }

  const platformFee = Number(payoutRule.customerPrice) - Number(payoutRule.providerPayoutAmount);
  return `${money(Number(payoutRule.providerPayoutAmount), payoutRule.currency ?? currency)} payout / ${money(platformFee, payoutRule.currency ?? currency)} fee`;
}

export function addressLabel(address: unknown) {
  if (typeof address === 'string') {
    return address;
  }
  if (address && typeof address === 'object') {
    const record = address as Record<string, unknown>;
    const knownText =
      record.addressText ?? record.address_text ?? record.address ?? record.label ?? record.name;
    if (typeof knownText === 'string' && knownText.trim()) {
      return knownText.trim();
    }
  }
  if (address && typeof address === 'object' && 'line1' in address) {
    return String((address as { line1?: unknown }).line1 ?? 'Address pending');
  }
  return 'Address pending';
}

export function bookingAddressSnapshotLabel(booking: AdminBookingDetail) {
  const snapshotText = booking.addressSnapshot?.addressText?.trim();
  if (snapshotText) {
    return snapshotText;
  }
  if (booking.addressSnapshot?.address) {
    return addressLabel(booking.addressSnapshot.address);
  }
  return addressLabel(booking.address);
}

export function coordinateLabel(lat?: string | number | null, lng?: string | number | null) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return 'No pin';
  }
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

export function distanceLabel(distance?: number | null) {
  if (distance === undefined || distance === null) {
    return 'No distance';
  }
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${distance} m`;
}

export function approximateDistanceMeters(
  startLat?: string | number | null,
  startLng?: string | number | null,
  endLat?: string | number | null,
  endLng?: string | number | null,
) {
  const lat1 = Number(startLat);
  const lng1 = Number(startLng);
  const lat2 = Number(endLat);
  const lng2 = Number(endLng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return null;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function money(amount?: number | null, currency = 'VND') {
  return formatMoney(amount, currency);
}

export function formatDate(value?: string | null) {
  return formatDateTime(value, 'Not set');
}

export function safeTime(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function minutesSince(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

export function shortId(id: string) {
  return formatShortId(id);
}
